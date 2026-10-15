import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiEye } from 'react-icons/fi';
import EnhancedWhatsAppPreview from '../TemplateAdd/WhatsAppPreview';

const TemplatePreviewModal = ({ isOpen, onClose, template }) => {
    // Transform template_data into the proper formData structure
    const formData = useMemo(() => {
        if (!template || !template.template_data) return null;

        const components = template.template_data?.components || [];

        // Initialize with default structure
        const transformedData = {
            name: template.name || '',
            category: template.category || '',
            language: template.language || 'en',
            components: {
                header: {
                    type: 'HEADER',
                    format: 'NONE',
                    text: '',
                    example: { header_handle: [] }
                },
                body: {
                    type: 'BODY',
                    text: '',
                    example: { body_text: [] }
                },
                footer: {
                    type: 'FOOTER',
                    text: ''
                },
                buttons: {
                    type: 'BUTTONS',
                    buttons: []
                }
            }
        };

        // Process each component from the template_data
        components.forEach(component => {
            switch (component.type) {
                case 'HEADER':
                    transformedData.components.header = {
                        type: 'HEADER',
                        format: component.format || 'TEXT',
                        text: component.text || '',
                        example: component.example || { header_handle: [] }
                    };
                    break;

                case 'BODY':
                    transformedData.components.body = {
                        type: 'BODY',
                        text: component.text || '',
                        example: component.example || { body_text: [] }
                    };
                    break;

                case 'FOOTER':
                    transformedData.components.footer = {
                        type: 'FOOTER',
                        text: component.text || ''
                    };
                    break;

                case 'BUTTONS':
                    transformedData.components.buttons = {
                        type: 'BUTTONS',
                        buttons: component.buttons || []
                    };
                    break;

                default:
                    break;
            }
        });

        return transformedData;
    }, [template]);

    // Extract body variables from the body text
    const bodyVariables = useMemo(() => {
        if (!formData?.components?.body?.text) return [];

        const variables = [];
        const variableMatches = formData.components.body.text.match(/\{\{(\d+)\}\}/g);

        if (variableMatches) {
            const samples = formData.components.body.example?.body_text?.[0] || [];
            variableMatches.forEach((match, index) => {
                const varNum = parseInt(match.replace(/[{}]/g, ''));
                variables.push({
                    id: Date.now() + index,
                    name: `var${varNum}`,
                    sample: samples[index] || ''
                });
            });
        }

        return variables;
    }, [formData]);

    return (
        <AnimatePresence>
            {isOpen && template && formData && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
                        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Cancel Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110"
                            aria-label="Close"
                        >
                            <FiX className="w-5 h-5" />
                        </button>

                        <div>
                            <EnhancedWhatsAppPreview
                                formData={formData}
                                bodyVariables={bodyVariables}
                                darkMode={false}
                            />
                        </div>


                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TemplatePreviewModal;
