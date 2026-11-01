import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth.token"
export function  loadToken(): string|null {
    return SecureStore.getItem(TOKEN_KEY)
}

export async function saveToken(token: string): Promise<void>{
    SecureStore.setItem(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void>{
    SecureStore.deleteItemAsync(TOKEN_KEY).finally()
}