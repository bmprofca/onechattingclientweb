import React, { useState, useRef, useEffect } from 'react';
import { FaFileAudio } from 'react-icons/fa';
import { FiMic, FiPlay, FiPause } from 'react-icons/fi';
import MediaModal from '../Modals/Conversation/MediaModal';

const AudioPreview = ({ fileInfo, isOwnMessage, isVoiceMessage = false, onTimeChange }) => {
    const [showModal, setShowModal] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const speedOptions = [1, 1.5, 2];
    const [speedIndex, setSpeedIndex] = useState(0);
    const playbackSpeed = speedOptions[speedIndex];
    const audioRef = useRef(null);
    const [regularIsPlaying, setRegularIsPlaying] = useState(false);
    const [regularCurrentTime, setRegularCurrentTime] = useState(0);
    const [regularDuration, setRegularDuration] = useState(0);
    const regularAudioRef = useRef(null);

    const handleError = () => setHasError(true);

    useEffect(() => {
        if (!isVoiceMessage) return;
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            const current = audio.currentTime || 0;
            const total = audio.duration || 0;
            setCurrentTime(current);
            if (onTimeChange) {
                onTimeChange(current, total);
            }
        };
        const updateDuration = () => {
            const total = audio.duration || 0;
            setDuration(total);
            if (onTimeChange) {
                onTimeChange(audio.currentTime || 0, total);
            }
        };
        const handleEnded = () => {
            setCurrentTime(audio.duration || 0);
            setIsPlaying(false);
        };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [isVoiceMessage, onTimeChange]);

    useEffect(() => {
        if (isVoiceMessage) return;
        const audio = regularAudioRef.current;
        if (!audio) return;

        const updateTime = () => {
            const current = audio.currentTime || 0;
            const total = audio.duration || 0;
            setRegularCurrentTime(current);
            if (onTimeChange) {
                onTimeChange(current, total);
            }
        };
        const updateDuration = () => {
            const total = audio.duration || 0;
            setRegularDuration(total);
            if (onTimeChange) {
                onTimeChange(audio.currentTime || 0, total);
            }
        };
        const handleEnded = () => {
            setRegularCurrentTime(audio.duration || 0);
            setRegularIsPlaying(false);
        };
        const handlePlay = () => setRegularIsPlaying(true);
        const handlePause = () => setRegularIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [isVoiceMessage, onTimeChange]);

    useEffect(() => {
        if (!isVoiceMessage) {
            setRegularCurrentTime(0);
            setRegularDuration(0);
            setRegularIsPlaying(false);
            const audio = regularAudioRef.current;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
                audio.load();
            }
            return;
        }

        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setSpeedIndex(0);
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.load();
        }
    }, [fileInfo?.serverUrl, isVoiceMessage]);

    useEffect(() => {
        if (!isVoiceMessage) return;
        const audio = audioRef.current;
        if (audio) {
            audio.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed, isVoiceMessage]);

    const togglePlay = async (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        if (!isPlaying) {
            try {
                await audio.play();
            } catch (err) {
                setIsPlaying(false);
            }
        } else {
            audio.pause();
        }
    };

    const cyclePlaybackSpeed = (e) => {
        e.stopPropagation();
        const nextIndex = (speedIndex + 1) % speedOptions.length;
        setSpeedIndex(nextIndex);
        const audio = audioRef.current;
        if (audio) {
            audio.playbackRate = speedOptions[nextIndex];
        }
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * duration;
    };

    const toggleRegularPlay = (e) => {
        e.stopPropagation();
        const audio = regularAudioRef.current;
        if (!audio) return;

        if (!regularIsPlaying) {
            audio.play().catch(() => setRegularIsPlaying(false));
        } else {
            audio.pause();
        }
    };

    const handleRegularProgressClick = (e) => {
        e.stopPropagation();
        const audio = regularAudioRef.current;
        if (!audio || !regularDuration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * regularDuration;
        setRegularCurrentTime(audio.currentTime);
    };

    if (hasError || !fileInfo?.serverUrl) {
        return (
            <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 w-full max-w-xs sm:max-w-sm">
                {isVoiceMessage ? (
                    <FiMic className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mb-3 sm:mb-4" />
                ) : (
                    <FaFileAudio className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mb-3 sm:mb-4" />
                )}
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 text-center mb-1 sm:mb-2">
                    {isVoiceMessage ? 'Voice message unavailable' : 'Audio unavailable'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                    Failed to load {isVoiceMessage ? 'voice message' : 'audio'}
                </p>
            </div>
        );
    }

    // Voice message UI - WhatsApp style
    if (isVoiceMessage) {
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        const displayTime = currentTime > 0 ? formatTime(currentTime) : formatTime(duration);
        const bubbleClasses = isOwnMessage
            ? 'bg-[#ECE9FD] text-gray-900'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
        const speedButtonClasses = isOwnMessage
            ? 'bg-[#DCD6FB] text-brand-900'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        const playButtonClasses = isOwnMessage
            ? 'bg-white/80 text-[#128c7e]'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        const accentColor = isOwnMessage ? '#128c7e' : '#0a7cff';
        const dottedColor = isOwnMessage ? 'rgba(2, 95, 67, 0.35)' : 'rgba(107, 114, 128, 0.45)';
        const progressTrackStyle = {
            backgroundImage: `repeating-linear-gradient(90deg, ${dottedColor} 0, ${dottedColor} 4px, transparent 4px, transparent 9px)`,
        };

        return (
            <>
                <div className={`inline-flex w-72 flex-col gap-2 rounded-2xl px-4 py-1 shadow-sm ${bubbleClasses}`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={cyclePlaybackSpeed}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${speedButtonClasses}`}
                        >
                            {`${playbackSpeed}x`}
                        </button>

                        {/* Play/Pause Button */}
                        <button
                            onClick={togglePlay}
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-inner transition-colors ${playButtonClasses}`}
                        >
                            {isPlaying ? (
                                <FiPause className="w-5 h-5" style={{ color: accentColor }} />
                            ) : (
                                <FiPlay className="w-5 h-5 ml-0.5" style={{ color: accentColor }} />
                            )}
                        </button>

                        {/* Progress Bar */}
                        <div className="flex-1">
                            <div
                                className="relative h-2 cursor-pointer rounded-full"
                                style={progressTrackStyle}
                                onClick={handleProgressClick}
                            >
                                <div
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                                    style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                                />
                                <span
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-white shadow"
                                    style={{ left: `${progressPercent}%`, backgroundColor: accentColor }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Time Row */}
                    {/* <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
                        <span>{displayTime}</span>
                        <span>{formatTime(duration || currentTime)}</span>
                    </div> */}
                </div>

                {/* Hidden Audio Element */}
                <audio
                    ref={audioRef}
                    onError={handleError}
                    style={{ display: 'none' }}
                >
                    <source src={fileInfo.serverUrl} type="audio/webm" />
                    <source src={fileInfo.serverUrl} type="audio/mpeg" />
                    <source src={fileInfo.serverUrl} type="audio/wav" />
                    <source src={fileInfo.serverUrl} type="audio/ogg" />
                </audio>
            </>
        );
    }

    // Regular audio file UI
    const regularProgressPercent =
        regularDuration > 0 ? (regularCurrentTime / regularDuration) * 100 : 0;
    const regularDisplayTime =
        regularCurrentTime > 0 ? formatTime(regularCurrentTime) : formatTime(regularDuration);
    const regularBubbleClasses = isOwnMessage
        ? 'bg-[#e9f2ff] text-gray-900'
        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    const regularIconBg = isOwnMessage ? 'bg-white/80 shadow-sm' : 'bg-gray-200 dark:bg-gray-700';
    const regularAccent = isOwnMessage ? '#0a7cff' : '#2563eb';
    const regularDottedColor = isOwnMessage
        ? 'rgba(10, 124, 255, 0.35)'
        : 'rgba(107, 114, 128, 0.35)';
    const regularProgressStyle = {
        backgroundImage: `repeating-linear-gradient(90deg, ${regularDottedColor} 0, ${regularDottedColor} 4px, transparent 4px, transparent 9px)`,
    };

    return (
        <>
            <div
                className={`inline-flex w-72  max-w-sm flex-col gap-3 rounded-2xl px-4 py-3 shadow-sm cursor-pointer ${regularBubbleClasses}`}
                onClick={() => setShowModal(true)}
            >
                <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${regularIconBg}`}>
                        <FaFileAudio className="w-5 h-5" style={{ color: regularAccent }} />
                    </div>

                    <div className="flex-1 flex flex-col gap-2 select-none">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {fileInfo.name || 'Audio File'}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleRegularPlay}
                                className="flex-shrink-0 w-10 h-10 rounded-full bg-white/90 dark:bg-gray-900/80 flex items-center justify-center shadow-inner"
                            >
                                {regularIsPlaying ? (
                                    <FiPause className="w-5 h-5" style={{ color: regularAccent }} />
                                ) : (
                                    <FiPlay className="w-5 h-5 ml-0.5" style={{ color: regularAccent }} />
                                )}
                            </button>

                            <div className="flex-1">
                                <div
                                    className="relative h-2 rounded-full cursor-pointer"
                                    style={regularProgressStyle}
                                    onClick={handleRegularProgressClick}
                                >
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                                        style={{ width: `${regularProgressPercent}%`, backgroundColor: regularAccent }}
                                    />
                                    <span
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border border-white shadow"
                                        style={{ left: `${regularProgressPercent}%`, backgroundColor: regularAccent }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400">
                            <span>{regularDisplayTime}</span>
                            <span>{formatTime(regularDuration || regularCurrentTime)}</span>
                        </div> */}
                    </div>
                </div>
            </div>

            <audio
                ref={regularAudioRef}
                onError={handleError}
                style={{ display: 'none' }}
            >
                <source src={fileInfo.serverUrl} type="audio/mpeg" />
                <source src={fileInfo.serverUrl} type="audio/wav" />
                <source src={fileInfo.serverUrl} type="audio/ogg" />
            </audio>

            <MediaModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                mediaItem={fileInfo}
                type="audio"
            />
        </>
    );
};

export default AudioPreview;