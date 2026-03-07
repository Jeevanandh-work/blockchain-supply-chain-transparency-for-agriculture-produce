import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const ProgressTracker = ({ steps, currentStep }) => {
  return (
    <div className="w-full py-8">
      <div className="relative flex items-center justify-between">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-200">
          <motion.div
            initial={{ width: '0%' }}
            animate={{
              width: `${(currentStep / (steps.length - 1)) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
            className="h-full bg-primary-600"
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex flex-col items-center"
            >
              {/* Circle */}
              <motion.div
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  backgroundColor: isCompleted || isCurrent ? '#16a34a' : '#e5e7eb',
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                  isCompleted || isCurrent ? 'text-white' : 'text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="font-semibold">{index + 1}</span>
                )}
              </motion.div>

              {/* Label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                className="absolute top-14 text-center w-24"
              >
                <p
                  className={`text-xs font-medium ${
                    isCurrent ? 'text-primary-600' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </p>
                {step.sublabel && (
                  <p className="text-xs text-gray-400 mt-1">{step.sublabel}</p>
                )}
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTracker;
