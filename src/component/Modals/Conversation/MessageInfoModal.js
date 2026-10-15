import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser } from 'react-icons/fi';
import { parseServerDate } from '../../../utils/dateTime';

const MessageInfoModal = ({ isOpen, onClose, message, activeChat }) => {
    const formatDateTime = (timestamp) => {
        if (!timestamp) return 'Unknown';
        const date = parseServerDate(timestamp);
        if (!date) return 'Unknown';
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const getStatusDisplay = (status) => {
        switch (status) {
            case 'pending': return 'Pending';
            case 'sent': return 'Sent';
            case 'delivered': return 'Delivered';
            case 'read': return 'Read';
            case 'failed': return 'Failed';
            default: return 'Unknown';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && message && (
            <motion.div
                key="modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="flex-shrink-0">
                            <FiUser className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Message Details
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            {/* Sender/Receiver Information */}
                            {message.type === 'out' && (message.send_by_name || message.send_by_mobile) && (
                                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent by</span>
                                    <div className="text-right">
                                        {message.send_by_name && (
                                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                {message.send_by_name}
                                            </div>
                                        )}
                                        {message.send_by_mobile && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {message.send_by_mobile}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {message.type === 'in' && (message.read_by_name || message.read_by_mobile) && (
                                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Read by</span>
                                    <div className="text-right">
                                        {message.read_by_name && (
                                            <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                {message.read_by_name}
                                            </div>
                                        )}
                                        {message.read_by_mobile && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {message.read_by_mobile}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Direction</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                    {message.type === 'out' ? 'Outgoing' : 'Incoming'}
                                </span>
                            </div>

                            {message.status && message.type === 'out' && (
                                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                                    <span className={`text-sm font-medium ${
                                        message.status === 'failed' ? 'text-red-500' :
                                        message.status === 'read' ? 'text-green-500' :
                                        message.status === 'delivered' ? 'text-blue-500' :
                                        'text-gray-500'
                                    }`}>
                                        {getStatusDisplay(message.status)}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Timestamp</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                    {formatDateTime(message.timestamp || message.create_date)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Chat</span>
                                <span className="text-sm text-gray-900 dark:text-white">{activeChat?.name || 'Unknown'}</span>
                            </div>

                            {message.failed_reason && (
                                <div className="flex justify-between items-start py-2 border-b border-gray-200 dark:border-gray-600">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Error</span>
                                    <span className="text-sm text-red-500 max-w-xs text-right">{message.failed_reason}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Close
                        </button>
                    </div>
                </motion.div>
            </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MessageInfoModal;

