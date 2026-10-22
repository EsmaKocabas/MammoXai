
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
}));

vi.mock('../config/db.js', () => ({
    pool: { query: queryMock },
}));

import {
    listNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from '../controllers/notification.controller.js';

import type { AuthRequest } from '../middlewares/auth.middleware.js';
import type { Response } from 'express';

function mockRequest(overrides: Record<string, unknown> = {}) {
    return {
        user: { id: 'doctor-123' },
        params: {},
        ...overrides,
    } as unknown as AuthRequest;
}

function mockResponse() {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
    };

    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);

    return res as unknown as Response & {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };
}

describe('Notification controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('bildirimleri ve okunmamış sayısını listeler', async () => {
        queryMock
            .mockResolvedValueOnce({
                rows: [{ id: 'notification-1', title: 'Test bildirimi' }],
            })
            .mockResolvedValueOnce({
                rows: [{ unread_count: 3 }],
            });

        const req = mockRequest();
        const res = mockResponse();

        await listNotifications(req, res);

        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(queryMock.mock.calls[0][1]).toEqual(['doctor-123']);
        expect(queryMock.mock.calls[1][1]).toEqual(['doctor-123']);

        expect(res.json).toHaveBeenCalledWith({
            unread_count: 3,
            notifications: [
                { id: 'notification-1', title: 'Test bildirimi' },
            ],
        });
    });

    it('geçersiz UUID için 400 döndürür', async () => {
        const req = mockRequest({
            params: { id: 'gecersiz-id' },
        });
        const res = mockResponse();

        await markAsRead(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(queryMock).not.toHaveBeenCalled();
    });

    it('bildirimi okundu olarak işaretler', async () => {
        const id = '550e8400-e29b-41d4-a716-446655440000';

        queryMock.mockResolvedValueOnce({
            rows: [{ id, is_read: true, read_at: new Date() }],
        });

        const req = mockRequest({ params: { id } });
        const res = mockResponse();

        await markAsRead(req, res);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notifications'),
            [id, 'doctor-123'],
        );

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Bildirim okundu olarak işaretlendi.',
            }),
        );
    });

    it('başka kullanıcıya ait veya bulunmayan bildirime 404 döndürür', async () => {
        const id = '550e8400-e29b-41d4-a716-446655440000';

        queryMock.mockResolvedValueOnce({ rows: [] });

        const req = mockRequest({ params: { id } });
        const res = mockResponse();

        await markAsRead(req, res);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('doctor_id = $2'),
            [id, 'doctor-123'],
        );

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('tüm okunmamış bildirimleri okundu yapar', async () => {
        queryMock.mockResolvedValueOnce({ rows: [], rowCount: 2 });

        const req = mockRequest();
        const res = mockResponse();

        await markAllAsRead(req, res);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('is_read = FALSE'),
            ['doctor-123'],
        );

        expect(res.json).toHaveBeenCalledWith({
            message: 'Tüm bildirimler okundu olarak işaretlendi.',
        });
    });

    it('bildirimi siler', async () => {
        const id = '550e8400-e29b-41d4-a716-446655440000';

        queryMock.mockResolvedValueOnce({
            rows: [{ id }],
        });

        const req = mockRequest({ params: { id } });
        const res = mockResponse();

        await deleteNotification(req, res);

        expect(queryMock).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notifications'),
            [id, 'doctor-123'],
        );

        expect(res.json).toHaveBeenCalledWith({
            message: 'Bildirim silindi.',
        });
    });
});
