import { http, HttpResponse } from "msw";
import {
    TEST_UUID,
    TEST_USERNAME,
    TEST_UUID_2,
    TEST_USERNAME_2,
    historyResponse,
    sessionsResponse,
    wrappedResponse,
} from "./data.ts";

const API_BASE = import.meta.env.VITE_FLASHLIGHT_URL;

export const handlers = [
    // Username lookup by UUID
    http.get(`${API_BASE}/v1/account/uuid/:uuid`, ({ params }) => {
        const uuid = params.uuid as string;
        if (uuid === TEST_UUID) {
            return HttpResponse.json({
                success: true,
                username: TEST_USERNAME,
                uuid: TEST_UUID,
            });
        }
        if (uuid === TEST_UUID_2) {
            return HttpResponse.json({
                success: true,
                username: TEST_USERNAME_2,
                uuid: TEST_UUID_2,
            });
        }
        return HttpResponse.json(
            { success: false, error: "Player not found" },
            { status: 404 },
        );
    }),

    // UUID lookup by username
    http.get(`${API_BASE}/v1/account/username/:username`, ({ params }) => {
        const username = params.username as string;
        if (username.toLowerCase() === TEST_USERNAME.toLowerCase()) {
            return HttpResponse.json({
                success: true,
                username: TEST_USERNAME,
                uuid: TEST_UUID,
            });
        }
        if (username.toLowerCase() === TEST_USERNAME_2.toLowerCase()) {
            return HttpResponse.json({
                success: true,
                username: TEST_USERNAME_2,
                uuid: TEST_UUID_2,
            });
        }
        return HttpResponse.json(
            { success: false, error: "Player not found" },
            { status: 404 },
        );
    }),

    // History
    http.post(`${API_BASE}/v1/history`, () => {
        return HttpResponse.json(historyResponse);
    }),

    // Sessions
    http.post(`${API_BASE}/v1/sessions`, () => {
        return HttpResponse.json(sessionsResponse);
    }),

    // Wrapped
    http.get(`${API_BASE}/v1/wrapped/:uuid/:year`, () => {
        return HttpResponse.json(wrappedResponse);
    }),
];
