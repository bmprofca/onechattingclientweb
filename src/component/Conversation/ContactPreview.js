import React from 'react';
import { FiUser } from 'react-icons/fi';

const ContactPreview = ({ contactInfo, isOwnMessage }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 w-full max-w-xs sm:max-w-sm overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center space-x-2 sm:space-x-3 p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiUser className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {contactInfo?.name || 'Contact'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Contact Card
                    </p>
                </div>
            </div>

            {/* Contact Details */}
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                {contactInfo?.phone && (
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                            <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                                {contactInfo.phone}
                            </p>
                        </div>
                        <a
                            href={`tel:${contactInfo.phone}`}
                            className="inline-flex items-center space-x-1 px-2 sm:px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0"
                        >
                            <span>Call</span>
                        </a>
                    </div>
                )}

                {contactInfo?.email && (
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                            {contactInfo.email}
                        </p>
                    </div>
                )}
            </div>

            {/* Save Contact Button */}
            <div className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-100 dark:border-gray-700">
                <button className="w-full inline-flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors">
                    <FiUser className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Save Contact</span>
                </button>
            </div>
        </div>
    );
};

export default ContactPreview;

