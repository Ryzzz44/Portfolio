import * as SecureStore from 'expo-secure-store';

const KEY = 'anthropic_api_key';

export const getApiKey = () => SecureStore.getItemAsync(KEY);
export const setApiKey = (v: string) => SecureStore.setItemAsync(KEY, v);
export const clearApiKey = () => SecureStore.deleteItemAsync(KEY);
