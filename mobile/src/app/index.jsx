import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import api from '../services/api';

export default function IndexScreen() {
  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const checarToken = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) router.replace('/home');
    };
    checarToken();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha o e-mail e a senha.');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), senha });
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('nome', data.nome);
      await AsyncStorage.setItem('email', email.trim().toLowerCase());
      router.replace('/home');
    } catch (err) {
      const msg = err?.response?.data?.erro || err?.response?.data?.mensagem || 'Erro ao fazer login.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErro('Preencha todos os campos.');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      await api.post('/auth/cadastrar', { nome: nome.trim(), email: email.trim(), senha });
      setErro('');
      setModo('login');
      setNome('');
      setSenha('');
      // Show success hint — user must log in after registering
      setErro('Conta criada! Faça login para continuar.');
    } catch (err) {
      const msg = err?.response?.data?.erro || err?.response?.data?.mensagem || 'Erro ao cadastrar.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (modo === 'login') handleLogin();
    else handleCadastro();
  };

  const isSuccess = modo === 'login' && erro.startsWith('Conta criada');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <VStack style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>

        {/* Logo */}
        <VStack style={{ alignItems: 'center', marginBottom: 48 }}>
          <Box
            style={{
              height: 80, width: 80, backgroundColor: '#2563eb',
              borderRadius: 24, alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 30 }}>F</Text>
          </Box>
          <Heading size="3xl" className="text-white font-extrabold">Financiária</Heading>
          <Text className="text-slate-400 mt-2 text-center">
            {modo === 'login' ? 'Entre na sua conta' : 'Crie sua conta gratuita'}
          </Text>
        </VStack>

        {/* Form */}
        <VStack space="md">

          {/* Nome — only in cadastro mode */}
          {modo === 'cadastro' && (
            <VStack space="xs">
              <Text className="text-sm font-semibold text-slate-300 ml-1">Nome</Text>
              <Input variant="outline" size="xl" className="rounded-2xl border-slate-800">
                <InputField
                  placeholder="Seu nome completo"
                  placeholderTextColor="#475569"
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                  className="text-white"
                />
              </Input>
            </VStack>
          )}

          {/* Email */}
          <VStack space="xs">
            <Text className="text-sm font-semibold text-slate-300 ml-1">E-mail</Text>
            <Input variant="outline" size="xl" className="rounded-2xl border-slate-800">
              <InputField
                placeholder="seu@email.com"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="text-white"
              />
            </Input>
          </VStack>

          {/* Senha */}
          <VStack space="xs">
            <Text className="text-sm font-semibold text-slate-300 ml-1">Senha</Text>
            <Input variant="outline" size="xl" className="rounded-2xl border-slate-800">
              <InputField
                placeholder="••••••••"
                placeholderTextColor="#475569"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                className="text-white"
              />
            </Input>
          </VStack>

          {/* Error / success message */}
          {erro ? (
            <Text
              className={`text-sm text-center font-semibold ${isSuccess ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {erro}
            </Text>
          ) : null}

          {/* Submit button */}
          <Button
            size="xl"
            isDisabled={loading}
            onPress={handleSubmit}
            className="rounded-2xl py-4 h-auto mt-2 bg-blue-600 active:bg-blue-700"
          >
            {loading ? (
              <Spinner className="text-white" />
            ) : (
              <ButtonText className="text-white font-extrabold text-base tracking-wide">
                {modo === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
              </ButtonText>
            )}
          </Button>

          {/* Toggle mode */}
          <Button
            variant="link"
            size="sm"
            onPress={() => { setModo(m => m === 'login' ? 'cadastro' : 'login'); setErro(''); }}
            className="mt-1"
          >
            <ButtonText className="text-slate-400 text-sm">
              {modo === 'login'
                ? 'Não tem conta? Cadastre-se'
                : 'Já tem conta? Fazer login'}
            </ButtonText>
          </Button>

        </VStack>

      </VStack>
    </SafeAreaView>
  );
}
