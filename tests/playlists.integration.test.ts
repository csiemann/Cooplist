
import request from 'supertest';
import express from 'express';
import { initDatabase, getDatabase } from '../src/database';
import playlistRoutes from '../src/routes/playlists';
import { authMiddleware } from '../src/middleware/authMiddleware';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key') as { userId: number, email: string };
            req.user = decoded;
        } catch (error) {
            // Invalid token
        }
    }
    next();
});

app.use('/playlists', playlistRoutes);

let ownerToken: string;
let memberToken: string;
let ownerId: number;
let memberId: number;

beforeAll(async () => {
    await initDatabase();
    const db = getDatabase();

    // Create owner user
    const ownerPassword = await bcrypt.hash('password123', 10);
    const owner = await db.run('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)', 'owner@test.com', ownerPassword, 'Owner', 'admin');
    ownerId = owner.lastID!;
    ownerToken = jwt.sign({ userId: ownerId, email: 'owner@test.com' }, process.env.JWT_SECRET || 'test-secret-key');

    // Create member user
    const memberPassword = await bcrypt.hash('password123', 10);
    const member = await db.run('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)', 'member@test.com', memberPassword, 'Member', 'member');
    memberId = member.lastID!;
    memberToken = jwt.sign({ userId: memberId, email: 'member@test.com' }, process.env.JWT_SECRET || 'test-secret-key');
});

describe('Playlists API', () => {
    it('should allow a member to view a private playlist', async () => {
        const db = getDatabase();

        // 1. Create a private playlist as the owner
        const createPlaylistResponse = await request(app)
            .post('/playlists')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Private Playlist', description: 'A test playlist', is_public: 0 });

        expect(createPlaylistResponse.status).toBe(201);
        const playlistId = createPlaylistResponse.body.playlist.id;

        // Manually set is_public to 0
        await db.run('UPDATE playlists SET is_public = 0 WHERE id = ?', playlistId);


        // 2. Add the member to the playlist
        await db.run('INSERT INTO playlist_members (playlist_id, user_id, role) VALUES (?, ?, ?)', playlistId, memberId, 'member');

        // 3. Member tries to access the playlist
        const getPlaylistResponse = await request(app)
            .get(`/playlists/${playlistId}`)
            .set('Authorization', `Bearer ${memberToken}`);

        expect(getPlaylistResponse.status).toBe(200);
        expect(getPlaylistResponse.body.playlist.name).toBe('Private Playlist');
    });
});
