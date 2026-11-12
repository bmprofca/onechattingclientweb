import axios from "axios";
import { API_BASE_URL } from "../config/api";

function getSession() {
    try {
        return JSON.parse(localStorage.getItem("userData") || "null");
    } catch (error) {
        return null;
    }
}

function authHeaders(session) {
    if (!session?.token || !session?.username) {
        throw new Error("Session expired");
    }
    return {
        token: session.token,
        username: session.username,
        "Content-Type": "application/json",
    };
}

export async function getOnboardingSettings(projectId) {
    const session = getSession();
    const response = await axios.get(`${API_BASE_URL}/onboarding/settings`, {
        params: { project_id: projectId },
        headers: authHeaders(session),
    });
    return response.data.data || response.data;
}

export async function saveOnboardingSettings(payload) {
    const session = getSession();
    const response = await axios.put(
        `${API_BASE_URL}/onboarding/settings`,
        payload,
        { headers: authHeaders(session) }
    );
    return response.data.data || response.data;
}
