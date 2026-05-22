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

export default function BemVindoScreen() {
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checarPerfil = async () => {
      const nomeSalvo = await AsyncStorage.getItem('nome');
      if (nomeSalvo) router.replace('/home');
    };
    checarPerfil();
  }, []);

  const handleEntrar = async () => {
    const nomeTrimado = nome.trim();
    if (!nomeTrimado) return;
    setLoading(true);
    await AsyncStorage.setItem('nome', nomeTrimado);
    await AsyncStorage.setItem('email', nomeTrimado.toLowerCase().replace(/\s+/g, '.'));
    router.replace('/home');
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
      <VStack className="flex-1 justify-center px-6">

        <VStack className="items-center mb-12">
          <Box className="h-20 w-20 bg-blue-600 rounded-3xl items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
            <Text className="text-white font-bold text-3xl">F</Text>
          </Box>
          <Heading size="3xl" className="text-slate-900 dark:text-white font-extrabold">Financiária</Heading>
          <Text className="text-slate-500 dark:text-slate-400 mt-2 text-center">
            Seu controle financeiro pessoal,{'\n'}salvo direto no seu celular
          </Text>
        </VStack>

        <VStack space="md">
          <VStack space="xs">
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Como quer ser chamado?</Text>
            <Input variant="outline" size="xl" className="rounded-2xl border-slate-200 dark:border-slate-800">
              <InputField
                placeholder="Seu nome"
                value={nome}
                onChangeText={setNome}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleEntrar}
              />
            </Input>
          </VStack>

          <Button
            size="xl"
            isDisabled={loading || !nome.trim()}
            onPress={handleEntrar}
            className="rounded-2xl py-4 h-auto mt-2 bg-blue-600 active:bg-blue-700 shadow-lg shadow-blue-500/30"
          >
            <ButtonText className="text-white font-extrabold text-base tracking-wide">COMEÇAR</ButtonText>
          </Button>
        </VStack>

      </VStack>
    </SafeAreaView>
  );
}
