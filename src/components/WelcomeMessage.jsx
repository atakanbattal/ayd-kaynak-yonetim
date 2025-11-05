import React from 'react';
import { motion } from 'framer-motion';

const WelcomeMessage = ({ name, role }) => {
  const roleTranslations = {
    admin: 'Yönetici',
    quality: 'Kalite',
    operator: 'Operatör',
  };

  return (
    <motion.div
      className='text-gray-800'
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <span className='font-semibold'>{name}</span>
      <span className='text-gray-500'> ({roleTranslations[role] || role})</span>
    </motion.div>
  );
};

export default WelcomeMessage;