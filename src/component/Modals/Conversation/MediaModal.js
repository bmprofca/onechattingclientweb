import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiImage, FiVideo, FiMusic, FiDownload, FiX, FiPlus, FiMinus } from 'react-icons/fi';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFile, FaFileImage, FaFileVideo, FaFileAudio } from 'react-icons/fa';
import { FiExternalLink } from 'react-icons/fi';
import ReactPlayer from 'react-player';

const MediaModal = ({ isOpen, onClose, mediaItem, type }) => {
    const [imageZoom, setImageZoom] = useState(1);

    const handleDownload = useCallback(async (e) => {
        e.preventDefault();
        if (!mediaItem?.serverUrl) return;
        try {
            const res = await fetch(mediaItem.serverUrl, { mode: 'cors' });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = mediaItem.name || 'image';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            const a = document.createElement('a');
            a.href = mediaItem.serverUrl;
            a.download = mediaItem.name || 'image';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }, [mediaItem?.serverUrl, mediaItem?.name]);

    useEffect(() => {
        if (isOpen && type === 'image') setImageZoom(1);
    }, [isOpen, type]);

    const getFileIcon = (fileName) => {
        const extension = fileName?.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf': return <FaFilePdf className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" />;
            case 'doc': case 'docx': return <FaFileWord className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500" />;
            case 'xls': case 'xlsx': return <FaFileExcel className="w-12 h-12 sm:w-16 sm:h-16 text-green-500" />;
            case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return <FaFileImage className="w-12 h-12 sm:w-16 sm:h-16 text-purple-500" />;
            case 'mp4': case 'avi': case 'mov': case 'webm': return <FaFileVideo className="w-12 h-12 sm:w-16 sm:h-16 text-orange-500" />;
            case 'mp3': case 'wav': case 'ogg': case 'm4a': return <FaFileAudio className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-500" />;
            default: return <FaFile className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500" />;
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'Unknown size';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const renderMediaContent = () => {
        switch (type) {
            case 'image':
                return (
                    <div className="flex items-center justify-center w-full h-full min-h-0 overflow-auto p-2 sm:p-4">
                        <div
                            className="flex items-center justify-center origin-center transition-transform duration-200"
                            style={{ transform: `scale(${imageZoom})` }}
                        >
                            <img
                                src={mediaItem.serverUrl}
                                alt={mediaItem.name || 'Image'}
                                className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg select-none"
                                style={{ maxHeight: '70vh' }}
                                draggable={false}
                            />
                        </div>
                    </div>
                );
            case 'video':
                return (
                    <div className="w-full h-full bg-black rounded-lg overflow-hidden">
                        <ReactPlayer
                            url={mediaItem.serverUrl}
                            width="100%"
                            height="100%"
                            controls
                            playing
                            config={{
                                file: {
                                    attributes: {
                                        controlsList: 'nodownload'
                                    }
                                }
                            }}
                        />
                    </div>
                );
            case 'audio':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8">
                        <FaFileAudio className="w-16 h-16 sm:w-24 sm:h-24 text-blue-500 mb-4 sm:mb-6" />
                        <audio
                            controls
                            className="w-full max-w-md"
                            autoPlay
                        >
                            <source src={mediaItem.serverUrl} type="audio/mpeg" />
                            <source src={mediaItem.serverUrl} type="audio/wav" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
                        {getFileIcon(mediaItem.name)}
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mt-3 sm:mt-4 mb-2">
                            Document Preview
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 px-2">
                            This document cannot be previewed in the browser. Please download to view.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                            <a
                                href={mediaItem.serverUrl}
                                download={mediaItem.name}
                                className="inline-flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
                            >
                                <FiDownload className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>Download</span>
                            </a>
                            <a
                                href={mediaItem.serverUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
                            >
                                <FiExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>Open</span>
                            </a>
                        </div>
                    </div>
                );
        }
    };

    return (
        <AnimatePresence>
            {isOpen && mediaItem && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-2 sm:p-4 overflow-hidden"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl w-full max-w-6xl max-h-[90dvh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                                {type === 'image' && <FiImage className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0" />}
                                {type === 'video' && <FiVideo className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" />}
                                {type === 'audio' && <FiMusic className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />}
                                {type === 'document' && <div className="flex-shrink-0">{getFileIcon(mediaItem.name)}</div>}
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                                        {mediaItem.name || `Untitled ${type}`}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {formatFileSize(mediaItem.size)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                                {type === 'image' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setImageZoom((z) => Math.min(z + 0.25, 3))}
                                            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                                            title="Zoom in"
                                        >
                                            <FiPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageZoom((z) => Math.max(z - 0.25, 0.5))}
                                            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                                            title="Zoom out"
                                        >
                                            <FiMinus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setImageZoom(1)}
                                            className="px-1.5 py-1.5 sm:px-2 sm:py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300 text-xs font-medium"
                                            title="Reset zoom (1:1)"
                                        >
                                            1:1
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="inline-flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors text-xs sm:text-sm"
                                >
                                    <FiDownload className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Download</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <FiX className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Media Content */}
                        <div className="flex-1 min-h-0 max-h-[calc(90dvh-4rem)] p-2 sm:p-4 overflow-auto flex flex-col">
                            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                                {renderMediaContent()}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MediaModal;

