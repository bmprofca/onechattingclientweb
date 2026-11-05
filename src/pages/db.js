import Dexie from 'dexie';
import { toServerTimestamp } from '../utils/dateTime';

let dbInstance = null;
let changeListeners = [];
let contactDbInstance = null;
let contactChangeListeners = [];

class ChatDatabase extends Dexie {
    constructor(dbName) {
        super(dbName || 'ChatDatabase');
        this.version(2).stores({
            chats: '++id, number, name, is_favorite, wamid, create_date, type, message_type, message, status, unique_id, last_id, lastUpdated, send_by_username, send_by_mobile',
            messages: `
                ++id,
                message_id,
                wamid,
                create_date,
                type,
                message_type,
                message,
                is_template,
                is_forwarded,
                is_reply,
                status,
                send_by_username,
                send_by_name,
                send_by_mobile,
                send_by_email,
                send_by_status,
                is_read,
                read_by_username,
                read_by_name,
                read_by_mobile,
                read_by_email,
                read_by_status,
                failed_reason,
                media_url,
                media_name,
                is_voice,
                address,
                latitude,
                longitude,
                name,
                reply_wamid,
                timestamp,
                retryCount,
                chat_number
            `,
        });
        this.version(3).stores({
            chats: '++id, number, name, is_favorite, wamid, create_date, type, message_type, message, status, unique_id, last_id, lastUpdated, send_by_username, send_by_mobile',
            messages: '++id, message_id, wamid, create_date, type, message_type, message, is_template, is_forwarded, is_reply, status, send_by_username, send_by_name, send_by_mobile, send_by_email, send_by_status, is_read, read_by_username, read_by_name, read_by_mobile, read_by_email, read_by_status, failed_reason, media_url, media_name, is_voice, address, latitude, longitude, name, reply_wamid, timestamp, retryCount, chat_number, interactive_reply'
        });

        // Set up change listeners
        this.setupChangeListeners();
    }

    setupChangeListeners() {
        // Listen for changes on chats table
        this.chats.hook('creating', (primKey, obj, transaction) => {
            this.notifyChangeListeners('chats', 'create', obj);
        });

        this.chats.hook('updating', (modifications, primKey, obj, transaction) => {
            this.notifyChangeListeners('chats', 'update', { ...obj, ...modifications });
        });

        this.chats.hook('deleting', (primKey, obj, transaction) => {
            this.notifyChangeListeners('chats', 'delete', obj);
        });

        // Listen for changes on messages table
        this.messages.hook('creating', (primKey, obj, transaction) => {
            this.notifyChangeListeners('messages', 'create', obj);
        });

        this.messages.hook('updating', (modifications, primKey, obj, transaction) => {
            this.notifyChangeListeners('messages', 'update', { ...obj, ...modifications });
        });

        this.messages.hook('deleting', (primKey, obj, transaction) => {
            this.notifyChangeListeners('messages', 'delete', obj);
        });
    }

    notifyChangeListeners(table, operation, data) {
        changeListeners.forEach(listener => {
            try {
                listener(table, operation, data);
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        });
    }
}

class ContactDatabase extends Dexie {
    constructor(dbName) {
        super(dbName || 'ContactDatabase');
        this.version(1).stores({
            contacts: '++id, contact_id, number, name, email, firm_name, website, remark, language_code, country, create_date, lastUpdated, groups, is_favorite'
        });

        // Set up database change listeners
        this.setupChangeListeners();
    }

    setupChangeListeners() {
        // Listen for changes on contacts table
        this.contacts.hook('creating', (primKey, obj, transaction) => {
            this.notifyChangeListeners('contacts', 'create', obj);
        });

        this.contacts.hook('updating', (modifications, primKey, obj, transaction) => {
            this.notifyChangeListeners('contacts', 'update', { ...obj, ...modifications });
        });

        this.contacts.hook('deleting', (primKey, obj, transaction) => {
            this.notifyChangeListeners('contacts', 'delete', obj);
        });
    }

    notifyChangeListeners(table, operation, data) {
        contactChangeListeners.forEach(listener => {
            try {
                listener(table, operation, data);
            } catch (error) {
                console.error('Error in contact change listener:', error);
            }
        });
    }
}

export const dbHelper = {
    async init(projectId) {
        if (!projectId) {
            console.warn('⚠️ Missing projectId in init()');
            projectId = 'default_project';
        }

        const dbName = `ChatDB_${projectId}`;

        try {
            if (dbInstance?.isOpen()) {
                dbInstance.close();
            }

            dbInstance = new ChatDatabase(dbName);
            await dbInstance.open();

            // console.log('✅ Database opened successfully:', dbName);
            return true;
        } catch (error) {
            console.error('❌ Failed to open database:', error);
            try {
                if (dbInstance) {
                    dbInstance.close();
                    await dbInstance.delete();
                }
                dbInstance = new ChatDatabase(dbName);
                await dbInstance.open();
                console.log('✅ Database recreated successfully:', dbName);
                return true;
            } catch (recreateError) {
                console.error('❌ Failed to recreate database:', recreateError);
                return false;
            }
        }
    },

    async deleteDatabase() {
        try {
            if (dbInstance) {
                dbInstance.close();
                await dbInstance.delete();
                dbInstance = null;
            }
        } catch (error) {
            console.error('❌ Error deleting database:', error);
        }
    },

    get db() {
        if (!dbInstance) throw new Error("Database not initialized. Call dbHelper.init(projectId) first.");
        return dbInstance;
    },

    // Add change listener
    setOnDataChange(callback) {
        changeListeners.push(callback);
        return () => {
            changeListeners = changeListeners.filter(cb => cb !== callback);
        };
    },

    // Remove change listener
    removeOnDataChange(callback) {
        changeListeners = changeListeners.filter(cb => cb !== callback);
    },

    async saveChats(chatList = []) {
        try {
            const db = this.db;

            if (!Array.isArray(chatList) || chatList.length === 0) {
                console.warn("⚠️ No chats to save.");
                return;
            }

            await db.transaction('rw', db.chats, async () => {
                for (const chat of chatList) {
                    const existing = await db.chats.where('number').equals(chat.number).first();

                    const safeName = (chat.name && String(chat.name).trim() !== '')
                        ? chat.name
                        : (existing?.name || chat.number);

                    const data = {
                        number: chat.number,
                        name: safeName,
                        is_favorite: typeof chat.is_favorite === 'boolean' ? chat.is_favorite : (existing?.is_favorite || false),
                        case_open_count: typeof chat.case_open_count === 'number' ? Math.max(0, chat.case_open_count) : (existing?.case_open_count ?? 0),
                        wamid: chat.wamid,
                        create_date: chat.create_date,
                        type: chat.type,
                        message_type: chat.message_type,
                        message: chat.message,
                        status: chat.status,
                        unique_id: chat.unique_id,
                        last_id: chat.last_id,
                        unread_count: typeof chat.unread_count === 'number' ? chat.unread_count : (existing?.unread_count || 0),
                        send_by_username: chat.send_by_username || '',
                        send_by_mobile: chat.send_by_mobile || '',
                        lastUpdated: Date.now()
                    };

                    if (existing) {
                        await db.chats.update(existing.id, data);
                    } else {
                        await db.chats.add(data);
                    }
                }
            });

            //console.log(`💾 Chats saved/updated successfully (${chatList.length} items).`);
        } catch (error) {
            console.error("❌ Error saving chats:", error);
        }
    },

    async getChats() {
        try {
            const db = this.db;
            return await db.chats.orderBy("last_id").reverse().toArray();
        } catch (error) {
            console.error("❌ Error getting chats:", error);
            return [];
        }
    },

    async saveMessage(messageList = []) {
        try {
            const db = this.db;

            if (!Array.isArray(messageList) || messageList.length === 0) {
                console.warn("⚠️ No messages to save.");
                return;
            }

            await db.transaction('rw', db.messages, async () => {
                for (const message of messageList) {
                    const data = {
                        message_id: message.message_id || '',
                        client_message_id: message.client_message_id || '',
                        wamid: message.wamid || '',
                        create_date: message.create_date || '',
                        type: message.type || '',
                        message_type: message.message_type || '',
                        message: message.message || '',
                        is_template: message.is_template || false,
                        is_forwarded: message.is_forwarded || false,
                        is_reply: message.is_reply || false,
                        status: message.status || '',
                        id: message.id || '',
                        send_by_username: message.send_by_username || '',
                        send_by_name: message.send_by_name || '',
                        send_by_mobile: message.send_by_mobile || '',
                        send_by_email: message.send_by_email || '',
                        send_by_status: message.send_by_status || false,
                        is_read: message.is_read || false,
                        read_by_username: message.read_by_username || '',
                        read_by_name: message.read_by_name || '',
                        read_by_mobile: message.read_by_mobile || '',
                        read_by_email: message.read_by_email || '',
                        read_by_status: message.read_by_status || false,
                        failed_reason: message.failed_reason || '',
                        media_url: message.media_url || '',
                        media_name: message.media_name || '',
                        is_voice: message.is_voice || false,
                        address: message.address || '',
                        latitude: message.latitude || '',
                        longitude: message.longitude || '',
                        name: message.name || '',
                        reply_wamid: message.reply_wamid || '',
                        timestamp: (
                            message.timestamp
                            || toServerTimestamp(message.create_date)
                            || Date.now()
                        ),
                        retryCount: message.retryCount || '',
                        chat_number: message.chat_number,
                        template: message.template || null,
                        component: message.component || null,
                        interactive: message.interactive || null,
                        interactive_reply: message.interactive_reply || null
                    };

                    // Prefer exact match by server message_id
                    let existing = message.message_id
                        ? await db.messages.where('message_id').equals(message.message_id).first()
                        : null;

                    // If not found, try matching by wamid (useful for merging temp → server message)
                    if (!existing && message.wamid) {
                        existing = await db.messages.where('wamid').equals(message.wamid).first();
                    }

                    if (existing) {
                        await db.messages.update(existing.id, data);
                    } else {
                        await db.messages.add(data);
                    }
                }
            });

            console.log(`💾 Messages saved/updated successfully (${messageList.length} items).`);
        } catch (error) {
            console.error("❌ Error saving messages:", error);
        }
    },

    async getMessages(chatNumber) {
        try {
            const db = this.db;
            const messages = await db.messages
                .where('chat_number')
                .equals(chatNumber)
                .sortBy('id');

            const confirmedOutgoing = messages.filter((message) =>
                message.type === 'out'
                && !String(message.message_id || '').startsWith('temp_')
                && (message.wamid || message.status === 'sent' || message.status === 'delivered' || message.status === 'read')
            );
            const optimisticOutgoing = messages.filter((message) =>
                message.type === 'out'
                && String(message.message_id || '').startsWith('temp_')
                && message.status !== 'failed'
            );
            const duplicateKeys = new Set();
            const matchedConfirmed = new Set();

            const getTimestamp = (message) => {
                const tempIdTime = String(message.message_id || '').match(/^temp_(\d+)$/)?.[1];
                const timestamp = tempIdTime
                    ? Number(tempIdTime)
                    : toServerTimestamp(message.timestamp || message.create_date);
                return Number.isFinite(timestamp) ? timestamp : undefined;
            };
            const sameContent = (optimistic, confirmed) =>
                optimistic.message_type === confirmed.message_type
                && optimistic.message === confirmed.message
                && (optimistic.media_url || '') === (confirmed.media_url || '')
                && (optimistic.reply_wamid || '') === (confirmed.reply_wamid || '')
                && Boolean(optimistic.is_template) === Boolean(confirmed.is_template);

            for (const confirmed of confirmedOutgoing) {
                const confirmedTime = getTimestamp(confirmed);
                if (!confirmedTime) continue;

                const duplicate = optimisticOutgoing
                    .filter((optimistic) =>
                        !duplicateKeys.has(optimistic.id)
                        && !matchedConfirmed.has(optimistic.id)
                        && sameContent(optimistic, confirmed)
                    )
                    .map((optimistic) => ({
                        message: optimistic,
                        distance: Math.abs((getTimestamp(optimistic) || 0) - confirmedTime),
                    }))
                    .filter((candidate) => candidate.distance <= 120000)
                    .sort((a, b) => a.distance - b.distance)[0];

                if (duplicate) {
                    duplicateKeys.add(duplicate.message.id);
                    matchedConfirmed.add(duplicate.message.id);
                }
            }

            if (duplicateKeys.size > 0) {
                await db.messages.bulkDelete([...duplicateKeys]);
                return messages.filter((message) => !duplicateKeys.has(message.id));
            }

            return messages;
        } catch (error) {
            console.error("❌ Error getting messages:", error);
            return [];
        }
    },

    /** Remove messages with null/empty server id (e.g. sent offline, never confirmed by backend) */
    async deleteMessagesWithNullId(chatNumber) {
        try {
            const db = this.db;
            const toDelete = await db.messages
                .where('chat_number')
                .equals(chatNumber)
                .filter((m) => m.id == null || m.id === '')
                .primaryKeys();
            if (toDelete.length > 0) {
                await db.messages.bulkDelete(toDelete);
                console.log(`🗑️ Removed ${toDelete.length} local message(s) with null id for chat ${chatNumber}`);
            }
        } catch (error) {
            console.error("❌ Error deleting messages with null id:", error);
        }
    },

    async addMessage(chatNumber, message) {
        try {
            const db = this.db;
            const data = {
                ...message,
                chat_number: chatNumber,
                timestamp: Date.now()
            };
            await db.messages.add(data);
        } catch (error) {
            console.error("❌ Error adding message:", error);
        }
    },

    async updateMessageStatus(messageId, status, failedReason = '', lastId = null) {
        try {
            const db = this.db;

            // Try to find message by message_id first, then wamid, then id (last_id)
            let message = await db.messages.where('message_id').equals(messageId).first();

            if (!message && messageId) {
                // Try matching by wamid as fallback
                message = await db.messages.where('wamid').equals(messageId).first();
            }

            if (!message && lastId) {
                // Try matching by id (last_id) as final fallback
                message = await db.messages.where('id').equals(String(lastId)).first();
            }

            if (!message) {
                console.warn(`Message with ID ${messageId} (or last_id: ${lastId}) not found`);
                return;
            }

            // Define status hierarchy (higher number = higher status)
            const statusHierarchy = {
                'pending': 1,
                'sent': 2,
                'delivered': 3,
                'read': 4,
                'failed': 0 // Failed can override any status
            };

            const currentStatusLevel = statusHierarchy[message.status] || 0;
            const newStatusLevel = statusHierarchy[status] || 0;

            // Only update if new status is higher or if it's a failure
            if (newStatusLevel > currentStatusLevel || status === 'failed') {
                const updateData = { status };
                if (failedReason && status === 'failed') {
                    updateData.failed_reason = failedReason;
                }

                // Update using the found message's primary key
                await db.messages.update(message.id, updateData);
                console.log(`✅ Message ${message.message_id || message.wamid || message.id} status updated from ${message.status} to ${status}`);

                // Update the chat's last message status if this is the latest message
                // Pass both message_id and wamid for better matching
                await this.updateChatLastMessageStatus(
                    message.chat_number, 
                    message.message_id || messageId, 
                    status,
                    message.wamid || messageId  // Also pass wamid for matching
                );
            } else {
                console.log(`⚠️ Message ${message.message_id || message.wamid || message.id} status not updated: ${message.status} → ${status} (downgrade not allowed)`);
            }
        } catch (error) {
            console.error("❌ Error updating message status:", error);
        }
    },

    async updateChatLastMessageStatus(chatNumber, messageId, status, messageWamid = null) {
        try {
            const db = this.db;

            if (!chatNumber) {
                console.warn('⚠️ No chatNumber provided to updateChatLastMessageStatus');
                return;
            }

            // Get the chat row
            const chatRow = await db.chats.where('number').equals(chatNumber).first();
            if (!chatRow) {
                console.log(`ℹ️ Chat ${chatNumber} not found in chats table`);
                return;
            }

            // Get the latest message for this chat (by timestamp, then by id)
            const latestMessage = await db.messages
                .where('chat_number')
                .equals(chatNumber)
                .reverse()
                .sortBy('timestamp')
                .then(msgs => msgs[0]);

            if (!latestMessage) {
                console.log(`ℹ️ No messages found for chat ${chatNumber}`);
                return;
            }

            // Check if the message being updated IS the latest message
            // Compare by multiple identifiers to be robust
            const msgIdStr = String(messageId || '');
            const wamidStr = String(messageWamid || '');
            
            const isLatestMessage = 
                (msgIdStr && latestMessage.message_id && String(latestMessage.message_id) === msgIdStr) ||
                (msgIdStr && latestMessage.wamid && String(latestMessage.wamid) === msgIdStr) ||
                (wamidStr && latestMessage.wamid && String(latestMessage.wamid) === wamidStr) ||
                (wamidStr && latestMessage.message_id && String(latestMessage.message_id) === wamidStr) ||
                (msgIdStr && latestMessage.id && String(latestMessage.id) === msgIdStr);

            if (isLatestMessage) {
                // Update the chat's status AND sync the identifiers
                const updateData = { 
                    status, 
                    lastUpdated: Date.now()
                };
                
                // Also sync the chat's identifiers with the latest message
                if (latestMessage.wamid) {
                    updateData.wamid = latestMessage.wamid;
                }
                if (latestMessage.message_id) {
                    updateData.unique_id = latestMessage.message_id;
                }
                if (latestMessage.id) {
                    updateData.last_id = latestMessage.id;
                }
                
                await db.chats.where('number').equals(chatNumber).modify(updateData);
                console.log(`✅ Chat ${chatNumber} last message status updated to: ${status}`);
            } else {
                console.log(`ℹ️ Skipped updating chat ${chatNumber} status; message ${messageId} is not the last message (latest: ${latestMessage.message_id || latestMessage.wamid})`);
            }
        } catch (error) {
            console.error("❌ Error updating chat last message status:", error);
        }
    },

    async updateMessageIdentifiersByMessageId(messageId, updates) {
        try {
            const db = this.db;
            if (!messageId || !updates || typeof updates !== 'object') {
                console.warn('⚠️ Invalid params to updateMessageIdentifiersByMessageId');
                return;
            }
            await db.messages
                .where('message_id')
                .equals(messageId)
                .modify(updates);
            console.log(`✅ Message ${messageId} identifiers updated`, updates);
        } catch (error) {
            console.error('❌ Error updating message identifiers:', error);
        }
    },

    async incrementRetryCount(messageId) {
        try {
            const db = this.db;
            const message = await db.messages.where('message_id').equals(messageId).first();
            if (message) {
                await db.messages.where('message_id').equals(messageId).modify({
                    retryCount: (message.retryCount || 0) + 1
                });
            }
        } catch (error) {
            console.error("❌ Error incrementing retry count:", error);
        }
    },

    // Merge server-echoed outgoing message into existing temp message (handles media and text)
    async mergeServerOutgoingMessage(chatNumber, serverMessage) {
        try {
            const db = this.db;

            const mediaUrl = serverMessage.media_url || '';
            const isText = !mediaUrl && (serverMessage.message_type === 'text' || serverMessage.message_type === 'template' || !serverMessage.message_type);

            // Find a recent outgoing temp message in the same chat matching media or text
            const recentMessages = await db.messages
                .where('chat_number')
                .equals(chatNumber)
                .sortBy('id');

            const candidate = [...recentMessages].reverse().find(m => {
                if (!m || m.type !== 'out') return false;
                if (serverMessage.client_message_id && m.client_message_id === serverMessage.client_message_id) {
                    return true;
                }
                const isPendingish = (m.status === 'pending' || m.status === 'sent' || !m.status);
                if (!isPendingish) return false;
                // Prefer temp ids for safer merge
                const isTempId = typeof m.message_id === 'string' && m.message_id.startsWith('temp_');
                if (isText) {
                    // For template: message may be null in history; match by is_template true
                    const matchesTemplate = (serverMessage.message_type === 'template' && m.is_template === true);
                    const matchesText = (serverMessage.message_type === 'text' && m.message_type === 'text' && m.message === serverMessage.message);
                    return (matchesTemplate || matchesText) && isTempId;
                }
                return m.media_url === mediaUrl;
            });

            if (candidate) {
                const existingServerMessage = serverMessage.message_id
                    ? await db.messages.where('message_id').equals(serverMessage.message_id).first()
                    : null;
                const mergedMessage = {
                    ...candidate,
                    ...serverMessage,
                    client_message_id: serverMessage.client_message_id || candidate.client_message_id || '',
                    chat_number: chatNumber,
                    message_id: serverMessage.message_id || candidate.message_id,
                    wamid: serverMessage.wamid || candidate.wamid,
                    id: existingServerMessage?.id || serverMessage.id || candidate.id,
                    create_date: serverMessage.create_date || candidate.create_date,
                    status: serverMessage.status || candidate.status,
                    message_type: serverMessage.message_type || candidate.message_type,
                    message: serverMessage.message !== null && serverMessage.message !== undefined ? serverMessage.message : candidate.message,
                    is_template: serverMessage.is_template !== undefined ? serverMessage.is_template : candidate.is_template,
                    template: serverMessage.template || candidate.template,
                    component: serverMessage.component || candidate.component,
                    interactive: serverMessage.interactive || candidate.interactive || null,
                    interactive_reply: serverMessage.interactive_reply || candidate.interactive_reply || null,
                    timestamp: (
                        serverMessage.timestamp
                        || toServerTimestamp(serverMessage.create_date)
                        || candidate.timestamp
                        || Date.now()
                    )
                };

                if (existingServerMessage) {
                    if (candidate.id !== existingServerMessage.id) {
                        await db.messages.delete(candidate.id);
                    }
                    await db.messages.update(existingServerMessage.id, {
                        ...mergedMessage,
                        id: existingServerMessage.id,
                    });
                } else {
                    await db.messages.delete(candidate.id);
                    await db.messages.add(mergedMessage);
                }

                // Also ensure chat row reflects latest identifiers
                const existingChat = await db.chats.where('number').equals(chatNumber).first();
                await this.saveChats([{
                    number: chatNumber,
                    name: existingChat?.name || chatNumber,
                    wamid: serverMessage.wamid || '',
                    create_date: serverMessage.create_date || '',
                    type: serverMessage.type || 'out',
                    message_type: serverMessage.message_type || candidate.message_type,
                    message: serverMessage.message !== null && serverMessage.message !== undefined ? serverMessage.message : candidate.message,
                    status: serverMessage.status || candidate.status,
                    unique_id: serverMessage.message_id || candidate.message_id,
                    last_id: serverMessage.id || candidate.id,
                    send_by_username: serverMessage.send_by_username || '',
                    send_by_mobile: serverMessage.send_by_mobile || ''
                }]);
                return;
            }

            const existingServerMessage = serverMessage.message_id
                ? await db.messages.where('message_id').equals(serverMessage.message_id).first()
                : null;
            if (existingServerMessage) {
                await db.messages.update(existingServerMessage.id, {
                    ...serverMessage,
                    id: existingServerMessage.id,
                    client_message_id: serverMessage.client_message_id || existingServerMessage.client_message_id || '',
                    chat_number: chatNumber,
                });
                return;
            }

            // No optimistic message exists yet; persist the server message with its correlation id.
            await this.saveMessage([{
                ...serverMessage,
                chat_number: chatNumber,
                timestamp: (
                    serverMessage.timestamp
                    || toServerTimestamp(serverMessage.create_date)
                    || Date.now()
                )
            }]);
        } catch (error) {
            console.error('❌ Error merging outgoing message:', error);
        }
    },

    async updateChat(chatNumber, updates) {
        try {
            const db = this.db;
            await db.chats.where('number').equals(chatNumber).modify(updates);
        } catch (error) {
            console.error("❌ Error updating chat:", error);
        }
    },

    async getMessageByMessageId(messageId) {
        try {
            const db = this.db;
            return await db.messages.where('message_id').equals(messageId).first();
        } catch (error) {
            console.error("❌ Error getting message by message_id:", error);
            return null;
        }
    }
};

export const contactDbHelper = {
    async init(projectId) {
        if (!projectId) {
            console.warn('⚠️ Missing projectId in contactDbHelper.init()');
            projectId = 'default_project';
        }

        const dbName = `ContactDB_${projectId}`;

        try {
            if (contactDbInstance?.isOpen()) {
                contactDbInstance.close();
            }

            contactDbInstance = new ContactDatabase(dbName);
            await contactDbInstance.open();

            console.log('✅ Contact Database opened successfully:', dbName);
            return true;
        } catch (error) {
            console.error('❌ Failed to open contact database:', error);
            try {
                if (contactDbInstance) {
                    contactDbInstance.close();
                    await contactDbInstance.delete();
                }
                contactDbInstance = new ContactDatabase(dbName);
                await contactDbInstance.open();
                console.log('✅ Contact Database recreated successfully:', dbName);
                return true;
            } catch (recreateError) {
                console.error('❌ Failed to recreate contact database:', recreateError);
                return false;
            }
        }
    },

    async deleteDatabase() {
        try {
            if (contactDbInstance) {
                contactDbInstance.close();
                await contactDbInstance.delete();
                contactDbInstance = null;
            }
        } catch (error) {
            console.error('❌ Error deleting contact database:', error);
        }
    },

    get db() {
        if (!contactDbInstance) throw new Error("Contact Database not initialized. Call contactDbHelper.init(projectId) first.");
        return contactDbInstance;
    },

    // Add change listener
    setOnDataChange(callback) {
        contactChangeListeners.push(callback);
        return () => {
            contactChangeListeners = contactChangeListeners.filter(cb => cb !== callback);
        };
    },

    // Remove change listener
    removeOnDataChange(callback) {
        contactChangeListeners = contactChangeListeners.filter(cb => cb !== callback);
    },

    async saveContacts(contactList = []) {
        try {
            const db = this.db;

            if (!Array.isArray(contactList) || contactList.length === 0) {
                console.warn("⚠️ No contacts to save.");
                return;
            }

            await db.transaction('rw', db.contacts, async () => {
                for (const contact of contactList) {
                    const existing = await db.contacts.where('number').equals(contact.number || contact.mobile).first();

                    const data = {
                        contact_id: contact.contact_id || contact.id || contact._id,
                        number: contact.number || contact.mobile || '',
                        name: contact.name || contact.number || contact.mobile || 'Unknown',
                        email: contact.email || '',
                        firm_name: contact.firm_name || contact.company || '',
                        website: contact.website || '',
                        remark: contact.remark || '',
                        language_code: contact.language_code || contact.languageCode || '',
                        country: contact.country || '',
                        create_date: contact.create_date || contact.createdOn || '',
                        groups: contact.groups || [],
                        is_favorite: contact.is_favorite || false,
                        lastUpdated: Date.now()
                    };

                    if (existing) {
                        await db.contacts.update(existing.id, data);
                    } else {
                        await db.contacts.add(data);
                    }
                }
            });

            console.log(`💾 Contacts saved/updated successfully (${contactList.length} items).`);
        } catch (error) {
            console.error("❌ Error saving contacts:", error);
        }
    },

    async getContacts(page = 1, limit = 10) {
        try {
            const db = this.db;
            const offset = (page - 1) * limit;

            const contacts = await db.contacts
                .orderBy("lastUpdated")
                .reverse()
                .offset(offset)
                .limit(limit)
                .toArray();

            const totalCount = await db.contacts.count();
            const totalPages = Math.ceil(totalCount / limit);

            return {
                contacts,
                totalCount,
                totalPages,
                currentPage: page
            };
        } catch (error) {
            console.error("❌ Error getting contacts:", error);
            return {
                contacts: [],
                totalCount: 0,
                totalPages: 1,
                currentPage: 1
            };
        }
    },

    async getAllContacts() {
        try {
            const db = this.db;
            return await db.contacts.orderBy("name").toArray();
        } catch (error) {
            console.error("❌ Error getting all contacts:", error);
            return [];
        }
    },

    async getContactByNumber(number) {
        try {
            const db = this.db;
            return await db.contacts.where('number').equals(number).first();
        } catch (error) {
            console.error("❌ Error getting contact by number:", error);
            return null;
        }
    },

    async addContact(contact) {
        try {
            const db = this.db;
            const data = {
                ...contact,
                lastUpdated: Date.now()
            };
            await db.contacts.add(data);
            console.log('✅ Contact added successfully');
        } catch (error) {
            console.error("❌ Error adding contact:", error);
        }
    },

    async updateContact(contactId, updates) {
        try {
            const db = this.db;
            await db.contacts.where('contact_id').equals(contactId).modify({
                ...updates,
                lastUpdated: Date.now()
            });
            console.log('✅ Contact updated successfully');
        } catch (error) {
            console.error("❌ Error updating contact:", error);
        }
    },

    async deleteContact(contactId, number = null) {
        try {
            const db = this.db;
            let deleted = 0;

            // Try to delete by number first (more reliable)
            if (number) {
                deleted = await db.contacts
                    .where('number')
                    .equals(String(number))
                    .delete();

                if (deleted > 0) {
                    console.log(`✅ Contact deleted by number: ${number} (${deleted} record(s))`);
                    return deleted;
                }
            }

            // Fallback: try to delete by contact_id
            if (contactId) {
                const contactIdStr = String(contactId);
                deleted = await db.contacts
                    .filter(contact => String(contact.contact_id) === contactIdStr)
                    .delete();

                if (deleted > 0) {
                    console.log(`✅ Contact deleted by contact_id: ${contactId} (${deleted} record(s))`);
                    return deleted;
                }
            }

            console.warn(`⚠️ No contact found with id: ${contactId} or number: ${number}`);
            return 0;
        } catch (error) {
            console.error("❌ Error deleting contact:", error);
            return 0;
        }
    },

    async searchContacts(query) {
        try {
            const db = this.db;
            const searchTerm = query.toLowerCase();

            return await db.contacts
                .filter(contact =>
                    contact.name.toLowerCase().includes(searchTerm) ||
                    contact.number.includes(searchTerm) ||
                    (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
                    (contact.firm_name && contact.firm_name.toLowerCase().includes(searchTerm))
                )
                .toArray();
        } catch (error) {
            console.error("❌ Error searching contacts:", error);
            return [];
        }
    },

    async clearContacts() {
        try {
            const db = this.db;
            await db.contacts.clear();
            console.log('✅ All contacts cleared');
        } catch (error) {
            console.error("❌ Error clearing contacts:", error);
        }
    }
};
