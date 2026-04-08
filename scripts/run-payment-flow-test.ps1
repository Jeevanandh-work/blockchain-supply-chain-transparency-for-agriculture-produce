  $ErrorActionPreference='Stop'

function TryStep($name,[scriptblock]$action){
  try {
    $r=&$action
    [PSCustomObject]@{step=$name;ok=$true;message='ok';data=$r}
  } catch {
    $m=$_.Exception.Message
    if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
    [PSCustomObject]@{step=$name;ok=$false;message=$m;data=$null}
  }
}

function NewWallet(){
  $hex=''
  1..40 | ForEach-Object { $hex += ('0123456789abcdef'[(Get-Random -Minimum 0 -Maximum 16)]) }
  '0x'+$hex
}

function RegisterUser($name,$email,$password,$wallet,$role){
  $body=@{name=$name;email=$email;password=$password;walletAddress=$wallet;role=$role;phoneNumber='9999999999';organization='Test Org'}|ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/register' -ContentType 'application/json' -Body $body
}

function Login($email,$password){
  $body=@{email=$email;password=$password}|ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/login' -ContentType 'application/json' -Body $body
}

$results=@()
$results += TryStep 'health_api' { Invoke-RestMethod -Method Get -Uri 'http://localhost:5000/api/health' }

$suffix=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$farmerEmail="flow_farmer_$suffix@example.com"
$distEmail="flow_distributor_$suffix@example.com"
$transEmail="flow_transport_$suffix@example.com"
$retEmail="flow_retailer_$suffix@example.com"

$farmerWallet=NewWallet
$distWallet=NewWallet
$transWallet=NewWallet
$retWallet=NewWallet

$results += TryStep 'register_farmer' { (RegisterUser 'Flow Farmer' $farmerEmail 'password123' $farmerWallet 'Farmer').success }
$results += TryStep 'register_distributor' { (RegisterUser 'Flow Distributor' $distEmail 'password123' $distWallet 'Distributor').success }
$results += TryStep 'register_transport' { (RegisterUser 'Flow Transport' $transEmail 'password123' $transWallet 'Transport').success }
$results += TryStep 'register_retailer' { (RegisterUser 'Flow Retailer' $retEmail 'password123' $retWallet 'Retailer').success }

$farmer = $null
$dist = $null
$ret = $null

$farmer = Login $farmerEmail 'password123'
$results += [PSCustomObject]@{ step='login_farmer'; ok=([bool]$farmer.success); message=if($farmer.success){'ok'}else{'failed'}; data=$farmer.success }

$dist = Login $distEmail 'password123'
$results += [PSCustomObject]@{ step='login_distributor'; ok=([bool]$dist.success); message=if($dist.success){'ok'}else{'failed'}; data=$dist.success }

$ret = Login $retEmail 'password123'
$results += [PSCustomObject]@{ step='login_retailer'; ok=([bool]$ret.success); message=if($ret.success){'ok'}else{'failed'}; data=$ret.success }

if(-not $farmer -or -not $dist -or -not $ret){
  $results | ConvertTo-Json -Depth 12
  exit 0
}

$farmerHeaders=@{Authorization="Bearer $($farmer.data.token)"}
$distHeaders=@{Authorization="Bearer $($dist.data.token)"}
$retHeaders=@{Authorization="Bearer $($ret.data.token)"}

$transportLookupWallet = $null
try {
  $u = Invoke-RestMethod -Method Get -Uri 'http://localhost:5000/api/user/role/transport' -Headers $distHeaders
  $transportLookupWallet = ($u.data | Where-Object { $_.email -eq $transEmail } | Select-Object -First 1).walletAddress
  if(-not $transportLookupWallet){ throw 'Transport wallet not found in role listing' }
  $results += [PSCustomObject]@{ step='lookup_transport_user'; ok=$true; message='ok'; data=$transportLookupWallet }
} catch {
  $m=$_.Exception.Message
  if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
  $results += [PSCustomObject]@{ step='lookup_transport_user'; ok=$false; message=$m; data=$null }
}

$batchId="BATCH-PAY-$suffix"
$results += TryStep 'create_batch_farmer' {
  $b=@{batchId=$batchId;productName='Payment Test Tomatoes';quantity=100;unit='kg';price=1200;metadata=@{}}|ConvertTo-Json -Depth 8
  (Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/create' -Headers $farmerHeaders -ContentType 'application/json' -Body $b).success
}

$farmerOrder=$null
try {
  $b=@{batchId=$batchId;stage='farmer';amount=1200}|ConvertTo-Json
  $farmerOrder=Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/order' -Headers $distHeaders -ContentType 'application/json' -Body $b
  $results += [PSCustomObject]@{ step='pay_farmer_order'; ok=$true; message='ok'; data=$farmerOrder.data.order.id }
} catch {
  $m=$_.Exception.Message
  if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
  $results += [PSCustomObject]@{ step='pay_farmer_order'; ok=$false; message=$m; data=$null }
}
$results += TryStep 'pay_farmer_verify' {
  $b=@{batchId=$batchId;stage='farmer';razorpay_order_id=$farmerOrder.data.order.id}|ConvertTo-Json
  (Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/verify' -Headers $distHeaders -ContentType 'application/json' -Body $b).success
}

$results += TryStep 'transfer_to_transport' {
  $b=@{batchId=$batchId;toAddress=$transportLookupWallet;message='Assigned for payment test transport';deliveryAddress='Retail Store Chennai';transportDetails=@{vehicleNumber='TN01AA1234';driverName='Test Driver';transportCompany='Agri Logistics';contactNumber='9999999999'}}|ConvertTo-Json -Depth 10
  (Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/transfer' -Headers $distHeaders -ContentType 'application/json' -Body $b).success
}

$transportOrder=$null
try {
  $b=@{batchId=$batchId;stage='transport';amount=180}|ConvertTo-Json
  $transportOrder=Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/order' -Headers $distHeaders -ContentType 'application/json' -Body $b
  $results += [PSCustomObject]@{ step='pay_transport_order'; ok=$true; message='ok'; data=$transportOrder.data.order.id }
} catch {
  $m=$_.Exception.Message
  if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
  $results += [PSCustomObject]@{ step='pay_transport_order'; ok=$false; message=$m; data=$null }
}
$results += TryStep 'pay_transport_verify' {
  $b=@{batchId=$batchId;stage='transport';razorpay_order_id=$transportOrder.data.order.id}|ConvertTo-Json
  (Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/verify' -Headers $distHeaders -ContentType 'application/json' -Body $b).success
}

$retOrder=$null
try {
  $b=@{batchId=$batchId;stage='distributor';amount=1200}|ConvertTo-Json
  $retOrder=Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/order' -Headers $retHeaders -ContentType 'application/json' -Body $b
  $results += [PSCustomObject]@{ step='pay_distributor_order_by_retailer'; ok=$true; message='ok'; data=$retOrder.data.order.id }
} catch {
  $m=$_.Exception.Message
  if($_.ErrorDetails -and $_.ErrorDetails.Message){$m=$_.ErrorDetails.Message}
  $results += [PSCustomObject]@{ step='pay_distributor_order_by_retailer'; ok=$false; message=$m; data=$null }
}
$results += TryStep 'pay_distributor_verify_by_retailer' {
  $b=@{batchId=$batchId;stage='distributor';razorpay_order_id=$retOrder.data.order.id}|ConvertTo-Json
  (Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/batch/payment/verify' -Headers $retHeaders -ContentType 'application/json' -Body $b).success
}

$results += TryStep 'final_batch_status' {
  $f=Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/batch/$batchId"
  [PSCustomObject]@{
    batchId=$batchId
    farmerPayment=$f.data.batch.payments.farmer.status
    transportPayment=$f.data.batch.payments.transport.status
    distributorPayment=$f.data.batch.payments.distributor.status
    finalStatus=$f.data.batch.status
  }
}

$results | ConvertTo-Json -Depth 12