/**
 * migrate-sections.ts
 * 
 * One-time migration script to add section field to all existing data.
 * Run with: npx ts-node scripts/migrate-sections.ts
 * 
 * Prerequisites:
 * 1. Place your Firebase service account key at scripts/serviceAccountKey.json
 * 2. Update FIREBASE_DATABASE_URL below
 * 
 * This script:
 * 1. Adds section: "23-24" to all students
 * 2. Adds targetSection: "23-24" to all notices
 * 3. Adds section: "23-24" to all materials
 * 4. MOVES routine docs from {dept_sem} to {23-24_dept_sem} (deletes old)
 * 5. MOVES board_rolls docs from {dept_sem} to {23-24_dept_sem} (deletes old)
 * 6. MOVES RTDB group_chats from group_{dept}_{sem} to group_23-24_{dept}_{sem} (deletes old)
 */

import * as admin from 'firebase-admin';

// ── CONFIG ──
const SECTION = '23-24';
const FIREBASE_DATABASE_URL = 'https://YOUR-PROJECT.firebaseio.com'; // UPDATE THIS

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: FIREBASE_DATABASE_URL,
});

const db = admin.firestore();
const rtdb = admin.database();

async function migrateStudents() {
    console.log('\n📚 Migrating students...');
    const snap = await db.collection('students').get();
    let count = 0;
    const batch = db.batch();

    snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.section) {
            batch.update(doc.ref, { section: SECTION });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
    }
    console.log(`   ✅ Updated ${count} students with section "${SECTION}"`);
}

async function migrateNotices() {
    console.log('\n📢 Migrating notices...');
    const snap = await db.collection('notices').get();
    let count = 0;

    // Firestore batch limit is 500
    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.targetSection) {
            currentBatch.update(doc.ref, { targetSection: SECTION });
            count++;
            batchCount++;

            if (batchCount >= 499) {
                batches.push(currentBatch);
                currentBatch = db.batch();
                batchCount = 0;
            }
        }
    });

    batches.push(currentBatch);

    for (const batch of batches) {
        await batch.commit();
    }
    console.log(`   ✅ Updated ${count} notices with targetSection "${SECTION}"`);
}

async function migrateMaterials() {
    console.log('\n📁 Migrating materials...');
    const snap = await db.collection('materials').get();
    let count = 0;
    const batch = db.batch();

    snap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.section) {
            batch.update(doc.ref, { section: SECTION });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
    }
    console.log(`   ✅ Updated ${count} materials with section "${SECTION}"`);
}

async function migrateRoutines() {
    console.log('\n📅 Migrating routines (MOVE: copy + delete old)...');
    const snap = await db.collection('routines').get();
    let count = 0;

    for (const docSnap of snap.docs) {
        const oldId = docSnap.id; // e.g., "computer_4th"
        const newId = `${SECTION}_${oldId}`; // e.g., "23-24_computer_4th"

        // Check if already migrated
        if (oldId.startsWith(`${SECTION}_`)) {
            console.log(`   ⏩ Skipping already migrated: ${oldId}`);
            continue;
        }

        const existingNew = await db.collection('routines').doc(newId).get();
        if (existingNew.exists) {
            // New exists, just delete old
            await db.collection('routines').doc(oldId).delete();
            console.log(`   🗑️ New already exists, deleted old: ${oldId}`);
            continue;
        }

        // Copy to new path
        await db.collection('routines').doc(newId).set(docSnap.data());
        // Delete old
        await db.collection('routines').doc(oldId).delete();
        count++;
        console.log(`   📦 Moved: ${oldId} → ${newId}`);
    }
    console.log(`   ✅ Moved ${count} routine docs`);
}

async function migrateBoardRolls() {
    console.log('\n📝 Migrating board_rolls (MOVE: copy + delete old)...');
    const snap = await db.collection('board_rolls').get();
    let count = 0;

    for (const docSnap of snap.docs) {
        const oldId = docSnap.id;
        const newId = `${SECTION}_${oldId}`;

        if (oldId.startsWith(`${SECTION}_`)) {
            console.log(`   ⏩ Skipping already migrated: ${oldId}`);
            continue;
        }

        const existingNew = await db.collection('board_rolls').doc(newId).get();
        if (existingNew.exists) {
            await db.collection('board_rolls').doc(oldId).delete();
            console.log(`   🗑️ New already exists, deleted old: ${oldId}`);
            continue;
        }

        await db.collection('board_rolls').doc(newId).set(docSnap.data());
        await db.collection('board_rolls').doc(oldId).delete();
        count++;
        console.log(`   📦 Moved: ${oldId} → ${newId}`);
    }
    console.log(`   ✅ Moved ${count} board_rolls docs`);
}

async function migrateGroupChats() {
    console.log('\n💬 Migrating RTDB group chats (MOVE: copy + delete old)...');
    let count = 0;

    // Get all group chats
    const groupChatsSnap = await rtdb.ref('group_chats').once('value');
    if (groupChatsSnap.exists()) {
        const chats = groupChatsSnap.val();
        for (const chatId of Object.keys(chats)) {
            // Only migrate group_{dept}_{sem} format (not global_chat, cr_group, or already migrated)
            if (!chatId.startsWith('group_')) continue;
            if (chatId === 'global_chat' || chatId === 'cr_group') continue;

            // Check if it's already in the new format (has section in it)
            // Old format: group_computer_4th
            // New format: group_23-24_computer_4th
            const parts = chatId.replace('group_', '').split('_');
            if (parts[0] === SECTION) continue; // Already migrated

            const newChatId = chatId.replace('group_', `group_${SECTION}_`);

            // Check if new already exists
            const existingNew = await rtdb.ref(`group_chats/${newChatId}`).once('value');
            if (existingNew.exists()) {
                // Delete old
                await rtdb.ref(`group_chats/${chatId}`).remove();
                console.log(`   🗑️ New already exists, deleted old: ${chatId}`);
                continue;
            }

            // Copy to new path
            await rtdb.ref(`group_chats/${newChatId}`).set(chats[chatId]);
            // Delete old
            await rtdb.ref(`group_chats/${chatId}`).remove();
            count++;
            console.log(`   📦 Moved: ${chatId} → ${newChatId}`);
        }
    }

    // Also migrate group_chats_meta
    const metaSnap = await rtdb.ref('group_chats_meta').once('value');
    if (metaSnap.exists()) {
        const meta = metaSnap.val();
        for (const chatId of Object.keys(meta)) {
            if (!chatId.startsWith('group_')) continue;
            if (chatId === 'global_chat' || chatId === 'cr_group') continue;

            const parts = chatId.replace('group_', '').split('_');
            if (parts[0] === SECTION) continue;

            const newChatId = chatId.replace('group_', `group_${SECTION}_`);

            const existingNew = await rtdb.ref(`group_chats_meta/${newChatId}`).once('value');
            if (existingNew.exists()) {
                await rtdb.ref(`group_chats_meta/${chatId}`).remove();
                continue;
            }

            await rtdb.ref(`group_chats_meta/${newChatId}`).set(meta[chatId]);
            await rtdb.ref(`group_chats_meta/${chatId}`).remove();
            console.log(`   📦 Meta moved: ${chatId} → ${newChatId}`);
        }
    }

    console.log(`   ✅ Moved ${count} group chats`);
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  NPC NOTICE BOARD — SECTION MIGRATION');
    console.log(`  Target Section: ${SECTION}`);
    console.log('═══════════════════════════════════════════');

    try {
        await migrateStudents();
        await migrateNotices();
        await migrateMaterials();
        await migrateRoutines();
        await migrateBoardRolls();
        await migrateGroupChats();

        console.log('\n═══════════════════════════════════════════');
        console.log('  ✅ MIGRATION COMPLETE!');
        console.log('═══════════════════════════════════════════\n');
    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error);
    }

    process.exit(0);
}

main();
