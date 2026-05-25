import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Em desenvolvimento: emulador Android usa 10.0.2.2, dispositivo físico usa o IP da máquina
// Em produção: substitua pela URL do Railway após o deploy
const DEV_URL = 'http://10.0.2.2:3001';
const PROD_URL = 'https://painel-financeiro-production-70fc.up.railway.app';

const api = axios.create({
  baseURL: __DEV__ ? DEV_URL : PROD_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
