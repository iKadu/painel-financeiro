import React, { useEffect, useState, useRef } from 'react';
import { FlatList, Alert, ScrollView, Modal, TouchableOpacity, AppState } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  initDatabase,
  getTransacoesLocal, getExcluidasLocal, getResumoLocal,
  criarTransacao, excluirTransacao, restaurarTransacao,
} from '../services/database';
import { syncWithServer } from '../services/sync';

import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const CATEGORIAS = {
  receita: ['Salário', 'Freelance', 'Investimentos', 'Aluguel', 'Outros'],
  despesa: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Outros'],
};

export default function HomeScreen() {
  const [transacoes, setTransacoes] = useState([]);
  const [transacoesExcluidas, setTransacoesExcluidas] = useState([]);
  const [resumo, setResumo] = useState({ receitas: 0, despesas: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [aba, setAba] = useState('ativas');
  const [isDark, setIsDark] = useState(true);
  const [showActionsheet, setShowActionsheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());
  const [novaTransacao, setNovaTransacao] = useState({
    tipo: 'despesa',
    categoria: '',
    valor: '',
    descricao: '',
    data: new Date().toISOString().split('T')[0],
    parcelar: false,
    numeroParcelas: '2',
    recorrente: false,
    mesesRecorrencia: '12',
  });

  // Refs so AppState closure always has the latest values
  const mesSel = useRef(mesSelecionado);
  const anoSel = useRef(anoSelecionado);
  const emailRef = useRef('');
  useEffect(() => { mesSel.current = mesSelecionado; }, [mesSelecionado]);
  useEffect(() => { anoSel.current = anoSelecionado; }, [anoSelecionado]);

  const theme = isDark ? {
    pageBg: 'bg-slate-950',
    navBg: 'bg-slate-900/50 border-b border-slate-800/80',
    cardBg: 'bg-slate-900 border border-slate-800',
    tabBg: 'bg-slate-900/60 border border-slate-800/60',
    itemBg: 'bg-slate-900/50 border border-slate-800/80',
    inputCls: 'rounded-2xl border-slate-800 bg-slate-950/50',
    modalBg: 'bg-slate-900',
    modalBorder: 'border-t border-slate-800',
    text: 'text-white',
    textMuted: 'text-slate-400',
    textSubtle: 'text-slate-500',
    divider: 'bg-slate-800/80',
    dragHandle: 'bg-slate-700',
    emptyText: 'text-slate-600',
    borderInactive: 'border-slate-800',
    logoutBtnCls: 'border-slate-800 bg-slate-900/30',
    saldoBorderL: 'border-slate-800/80',
    tagReceita: 'bg-emerald-950/30 border border-emerald-500/20',
    tagDespesa: 'bg-rose-950/30 border border-rose-500/20',
    tagReceitaText: 'text-emerald-400',
    tagDespesaText: 'text-rose-400',
    toggleIcon: 'sunny-outline',
    toggleColor: '#fbbf24',
    placeholder: '#475569',
  } : {
    pageBg: 'bg-gray-50',
    navBg: 'bg-white border-b border-gray-200',
    cardBg: 'bg-white border border-gray-200',
    tabBg: 'bg-gray-100 border border-gray-200',
    itemBg: 'bg-white border border-gray-200',
    inputCls: 'rounded-2xl border-gray-300 bg-white',
    modalBg: 'bg-white',
    modalBorder: 'border-t border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    textSubtle: 'text-gray-400',
    divider: 'bg-gray-200',
    dragHandle: 'bg-gray-300',
    emptyText: 'text-gray-400',
    borderInactive: 'border-gray-200',
    logoutBtnCls: 'border-gray-200 bg-gray-100',
    saldoBorderL: 'border-gray-200',
    tagReceita: 'bg-emerald-100 border border-emerald-300',
    tagDespesa: 'bg-rose-100 border border-rose-300',
    tagReceitaText: 'text-emerald-600',
    tagDespesaText: 'text-rose-600',
    toggleIcon: 'moon-outline',
    toggleColor: '#6366f1',
    placeholder: '#94a3b8',
  };

  useEffect(() => {
    const init = async () => {
      const [savedNome, savedEmail] = await Promise.all([
        AsyncStorage.getItem('nome'),
        AsyncStorage.getItem('email'),
      ]);
      const em = savedEmail || '';
      setNome(savedNome || '');
      setEmail(em);
      emailRef.current = em;
      await initDatabase();
      await carregarDados(mesSelecionado, anoSelecionado, em);
      const synced = await syncWithServer();
      if (synced) await carregarDados(mesSelecionado, anoSelecionado, em);
    };
    init();
  }, []);

  useEffect(() => {
    if (email) carregarDados(mesSelecionado, anoSelecionado, email);
  }, [mesSelecionado, anoSelecionado]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncWithServer().then(ok => {
          if (ok) carregarDados(mesSel.current, anoSel.current, emailRef.current);
        });
      }
    });
    return () => sub.remove();
  }, []);

  const carregarDados = async (mes, ano, emailParam) => {
    const em = emailParam ?? email;
    try {
      const [resumo, ativas, excluidas] = await Promise.all([
        getResumoLocal(em, mes, ano),
        getTransacoesLocal(em, mes, ano),
        getExcluidasLocal(em, mes, ano),
      ]);
      setResumo(resumo);
      setTransacoes(ativas);
      setTransacoesExcluidas(excluidas);
    } catch (err) {
      console.error('Erro ao carregar dados locais:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'nome', 'email']);
    router.replace('/');
  };

  const irMesAnterior = () => {
    if (mesSelecionado === 1) { setMesSelecionado(12); setAnoSelecionado(a => a - 1); }
    else { setMesSelecionado(m => m - 1); }
  };

  const irProximoMes = () => {
    if (mesSelecionado === 12) { setMesSelecionado(1); setAnoSelecionado(a => a + 1); }
    else { setMesSelecionado(m => m + 1); }
  };

  const defaultData = () => {
    const h = new Date();
    if (mesSelecionado === h.getMonth() + 1 && anoSelecionado === h.getFullYear())
      return h.toISOString().split('T')[0];
    return `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}-01`;
  };

  const addMonths = (dateStr, months) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1 + months, d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
  };

  const handleValorChange = (texto) => {
    const apenasNumeros = texto.replace(/\D/g, '');
    if (apenasNumeros === '') {
      setNovaTransacao({ ...novaTransacao, valor: '' });
      return;
    }
    const valorFloat = (parseInt(apenasNumeros, 10) / 100).toFixed(2);
    setNovaTransacao({ ...novaTransacao, valor: valorFloat });
  };

  const resetForm = () => {
    setNovaTransacao({
      tipo: 'despesa', categoria: '', valor: '', descricao: '',
      data: defaultData(),
      parcelar: false, numeroParcelas: '2',
      recorrente: false, mesesRecorrencia: '12',
    });
  };

  const handleAdicionar = async () => {
    if (!novaTransacao.categoria || !novaTransacao.valor || !novaTransacao.data) {
      Alert.alert('Aviso', 'Preencha o valor, a data e selecione uma categoria.');
      return;
    }

    const isParcelas = novaTransacao.tipo === 'despesa' && novaTransacao.parcelar;
    const isRecorrente = novaTransacao.tipo === 'receita' && novaTransacao.recorrente;
    const n = isParcelas ? parseInt(novaTransacao.numeroParcelas, 10) || 1
             : isRecorrente ? parseInt(novaTransacao.mesesRecorrencia, 10) || 1
             : 1;

    if (n < 1 || n > 60) {
      Alert.alert('Aviso', 'Informe um número entre 1 e 60.');
      return;
    }

    setSubmitting(true);
    try {
      if (isParcelas) {
        const valorParcela = (parseFloat(novaTransacao.valor) / n).toFixed(2);
        for (let i = 0; i < n; i++) {
          await criarTransacao(email, {
            tipo: 'despesa',
            categoria: novaTransacao.categoria,
            valor: valorParcela,
            descricao: `${novaTransacao.descricao ? novaTransacao.descricao + ' ' : ''}(${i + 1}/${n})`,
            data: addMonths(novaTransacao.data, i),
          });
        }
      } else if (isRecorrente) {
        for (let i = 0; i < n; i++) {
          await criarTransacao(email, {
            tipo: 'receita',
            categoria: novaTransacao.categoria,
            valor: novaTransacao.valor,
            descricao: novaTransacao.descricao || '',
            data: addMonths(novaTransacao.data, i),
          });
        }
      } else {
        await criarTransacao(email, {
          tipo: novaTransacao.tipo,
          categoria: novaTransacao.categoria,
          valor: novaTransacao.valor,
          descricao: novaTransacao.descricao,
          data: novaTransacao.data,
        });
      }
      resetForm();
      setShowActionsheet(false);
      carregarDados(mesSelecionado, anoSelecionado);
    } catch (err) {
      Alert.alert('Erro', 'Erro ao salvar transação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletar = async (id) => {
    Alert.alert('Atenção', 'Deseja mover esta transação para a lixeira?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim, deletar',
        style: 'destructive',
        onPress: async () => {
          await excluirTransacao(id);
          carregarDados(mesSelecionado, anoSelecionado);
        }
      }
    ]);
  };

  const handleRestaurar = async (id) => {
    await restaurarTransacao(id);
    carregarDados(mesSelecionado, anoSelecionado);
  };

  if (loading) {
    return (
      <Box className={`flex-1 justify-center items-center ${theme.pageBg}`}>
        <Spinner size="large" className="text-blue-500" />
      </Box>
    );
  }

  const transacoesExibidas = aba === 'ativas' ? transacoes : transacoesExcluidas;

  return (
    <SafeAreaView className={`flex-1 ${theme.pageBg}`}>
      {/* Navbar */}
      <HStack className={`px-6 py-5 justify-between items-center ${theme.navBg}`}>
        <HStack className="items-center" space="md">
          <Box
            className="h-11 w-11 rounded-full items-center justify-center border-2 border-blue-400/20"
            style={{ backgroundColor: '#2563eb' }}
          >
            <Text className="text-white font-bold text-lg">{nome.charAt(0).toUpperCase()}</Text>
          </Box>
          <VStack space="xs">
            <Text className={`${theme.textMuted} text-xs font-semibold uppercase tracking-wider`}>Dashboard</Text>
            <Heading size="md" className={`${theme.text} font-extrabold tracking-tight`}>Olá, {nome.split(' ')[0]}</Heading>
          </VStack>
        </HStack>
        <HStack space="sm" className="items-center">
          <TouchableOpacity
            onPress={() => setIsDark(d => !d)}
            style={{ padding: 8, borderRadius: 10 }}
          >
            <Ionicons name={theme.toggleIcon} size={22} color={theme.toggleColor} />
          </TouchableOpacity>
          <Button
            variant="outline"
            size="sm"
            onPress={handleLogout}
            className={`rounded-xl ${theme.logoutBtnCls}`}
          >
            <ButtonText className="text-red-400 font-semibold text-xs">Sair</ButtonText>
          </Button>
        </HStack>
      </HStack>

      <Box className="flex-1 px-6 pt-6">
        {/* Seletor de Mês */}
        <HStack className="items-center justify-between mb-4">
          <TouchableOpacity onPress={irMesAnterior} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={22} color={isDark ? '#94a3b8' : '#6b7280'} />
          </TouchableOpacity>
          <VStack className="items-center">
            <Text className={`font-extrabold text-base ${theme.text}`}>
              {MESES[mesSelecionado - 1]}
            </Text>
            <Text className={`text-xs ${theme.textMuted}`}>{anoSelecionado}</Text>
          </VStack>
          <TouchableOpacity onPress={irProximoMes} style={{ padding: 8 }}>
            <Ionicons name="chevron-forward" size={22} color={isDark ? '#94a3b8' : '#6b7280'} />
          </TouchableOpacity>
        </HStack>

        {/* Card Saldo */}
        <Box className={`${theme.cardBg} rounded-3xl p-6 shadow-2xl relative overflow-hidden mb-6`}>
          <Text className={`${theme.textMuted} font-medium text-xs uppercase tracking-wider`}>Saldo Total Disponível</Text>
          <Heading size="3xl" className={`${theme.text} mt-2 font-black tracking-tight`}>
            {formatarMoeda(resumo.saldo)}
          </Heading>
          <Box className={`h-[1px] ${theme.divider} my-5`} />
          <HStack className="justify-between" space="xl">
            <VStack space="xs" className="flex-1">
              <HStack space="xs" className="items-center">
                <Box className="h-2 w-2 rounded-full bg-emerald-500" />
                <Text className={`${theme.textMuted} text-xs uppercase tracking-wider`}>Receitas</Text>
              </HStack>
              <Text className="text-emerald-400 font-bold text-lg">{formatarMoeda(resumo.receitas)}</Text>
            </VStack>
            <VStack space="xs" className={`flex-1 border-l ${theme.saldoBorderL} pl-6`}>
              <HStack space="xs" className="items-center">
                <Box className="h-2 w-2 rounded-full bg-rose-500" />
                <Text className={`${theme.textMuted} text-xs uppercase tracking-wider`}>Despesas</Text>
              </HStack>
              <Text className="text-rose-400 font-bold text-lg">{formatarMoeda(resumo.despesas)}</Text>
            </VStack>
          </HStack>
        </Box>

        {/* Abas */}
        <HStack className={`${theme.tabBg} p-1.5 rounded-2xl mb-6`}>
          <Button
            onPress={() => setAba('ativas')}
            className={`flex-1 rounded-xl py-2.5 ${aba === 'ativas' ? 'bg-blue-600' : 'bg-transparent'}`}
          >
            <ButtonText className={`font-bold text-sm ${aba === 'ativas' ? 'text-white' : theme.textMuted}`}>Fluxo de Caixa</ButtonText>
          </Button>
          <Button
            onPress={() => setAba('excluidas')}
            className={`flex-1 rounded-xl py-2.5 ${aba === 'excluidas' ? 'bg-rose-600' : 'bg-transparent'}`}
          >
            <ButtonText className={`font-bold text-sm ${aba === 'excluidas' ? 'text-white' : theme.textMuted}`}>Lixeira</ButtonText>
          </Button>
        </HStack>

        {/* Lista de Transações */}
        <FlatList
          data={transacoesExibidas}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: aba === 'ativas' ? 96 : 16 }}
          ListEmptyComponent={
            <VStack className="items-center justify-center py-16" space="md">
              <Text className={`${theme.emptyText} text-lg`}>Nenhuma transação encontrada</Text>
            </VStack>
          }
          renderItem={({ item }) => (
            <HStack className={`items-center justify-between ${theme.itemBg} p-4 rounded-2xl mb-3 ${aba === 'excluidas' ? 'opacity-75' : ''}`}>
              <HStack className="items-center flex-1" space="md">
                <Box className={`h-11 w-11 rounded-xl items-center justify-center ${item.tipo === 'receita' ? theme.tagReceita : theme.tagDespesa}`}>
                  <Text className={`font-black text-lg ${item.tipo === 'receita' ? theme.tagReceitaText : theme.tagDespesaText}`}>
                    {item.tipo === 'receita' ? '+' : '-'}
                  </Text>
                </Box>
                <VStack className="flex-1" space="xs">
                  <Text className={`font-bold ${theme.text} text-base leading-tight`}>{item.categoria}</Text>
                  {item.descricao ? <Text className={`${theme.textMuted} text-xs`} numberOfLines={1}>{item.descricao}</Text> : null}
                  <Text className={`${theme.textSubtle} text-[10px] font-semibold uppercase tracking-wider`}>
                    {new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </Text>
                </VStack>
              </HStack>
              <VStack className="items-end" space="sm">
                <Text className={`font-black text-base ${item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatarMoeda(item.valor)}
                </Text>
                {aba === 'ativas' ? (
                  <Button
                    size="xs"
                    variant="outline"
                    className="rounded-lg border-rose-950 px-2 py-1 h-7"
                    onPress={() => handleDeletar(item.id)}
                  >
                    <ButtonText className="text-rose-400 text-[10px] font-bold">EXCLUIR</ButtonText>
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="outline"
                    className="rounded-lg border-blue-950 px-2 py-1 h-7"
                    onPress={() => handleRestaurar(item.id)}
                  >
                    <ButtonText className="text-blue-400 text-[10px] font-bold">RESTAURAR</ButtonText>
                  </Button>
                )}
              </VStack>
            </HStack>
          )}
        />
      </Box>

      {/* FAB — visível apenas na aba de ativos */}
      {aba === 'ativas' && (
        <TouchableOpacity
          onPress={() => setShowActionsheet(true)}
          activeOpacity={0.8}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: '#2563eb',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#2563eb',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal Nova Transação */}
      <Modal
        visible={showActionsheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActionsheet(false)}
      >
        <Box className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowActionsheet(false)}
          />
          <Box className={`${theme.modalBg} ${theme.modalBorder} rounded-t-3xl`} style={{ maxHeight: '90%' }}>
            <Box className="w-full py-3 items-center">
              <Box className={`w-16 h-1.5 ${theme.dragHandle} rounded-full`} />
            </Box>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
            >
              <VStack space="xl" className="w-full">

                <Heading size="lg" className={`${theme.text} font-extrabold tracking-tight text-center`}>Nova Transação</Heading>

                {/* Tipo */}
                <VStack space="xs">
                  <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Tipo de Fluxo</Text>
                  <HStack space="md">
                    <Button
                      className={`flex-1 rounded-2xl py-3 h-auto border-2 justify-center items-center ${novaTransacao.tipo === 'despesa' ? 'border-rose-500 bg-rose-500/10' : `${theme.borderInactive} bg-transparent`}`}
                      onPress={() => setNovaTransacao({ ...novaTransacao, tipo: 'despesa', categoria: '', parcelar: false, recorrente: false })}
                    >
                      <ButtonText className={novaTransacao.tipo === 'despesa' ? 'text-rose-400 font-bold' : `${theme.textSubtle} font-medium`}> Despesa</ButtonText>
                    </Button>
                    <Button
                      className={`flex-1 rounded-2xl py-3 h-auto border-2 justify-center items-center ${novaTransacao.tipo === 'receita' ? 'border-emerald-500 bg-emerald-500/10' : `${theme.borderInactive} bg-transparent`}`}
                      onPress={() => setNovaTransacao({ ...novaTransacao, tipo: 'receita', categoria: '', parcelar: false, recorrente: false })}
                    >
                      <ButtonText className={novaTransacao.tipo === 'receita' ? 'text-emerald-400 font-bold' : `${theme.textSubtle} font-medium`}> Receita</ButtonText>
                    </Button>
                  </HStack>
                </VStack>

                {/* Valor e Data */}
                <HStack space="md">
                  <VStack space="xs" className="flex-1">
                    <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Valor (R$)</Text>
                    <Input variant="outline" size="xl" className={theme.inputCls}>
                      <InputField
                        placeholder="0,00"
                        placeholderTextColor={theme.placeholder}
                        keyboardType="numeric"
                        className={`${theme.text} font-bold text-lg`}
                        value={novaTransacao.valor ? formatarMoeda(novaTransacao.valor).replace(/^R\$\s*/, '') : ''}
                        onChangeText={handleValorChange}
                      />
                    </Input>
                  </VStack>
                  <VStack space="xs" className="flex-1">
                    <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Data</Text>
                    <Input variant="outline" size="xl" className={theme.inputCls}>
                      <InputField
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.placeholder}
                        className={`${theme.text} font-semibold text-base`}
                        value={novaTransacao.data}
                        onChangeText={v => setNovaTransacao({ ...novaTransacao, data: v })}
                      />
                    </Input>
                  </VStack>
                </HStack>

                {/* Categoria */}
                <VStack space="xs">
                  <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <HStack space="xs">
                      {(CATEGORIAS[novaTransacao.tipo] || []).map(cat => (
                        <Button
                          key={cat}
                          className={`rounded-full px-5 py-2 border-2 ${novaTransacao.categoria === cat ? 'bg-blue-600 border-blue-500' : `bg-transparent ${theme.borderInactive}`}`}
                          onPress={() => setNovaTransacao({ ...novaTransacao, categoria: cat })}
                        >
                          <ButtonText className={`text-xs font-bold ${novaTransacao.categoria === cat ? 'text-white' : theme.textMuted}`}>{cat}</ButtonText>
                        </Button>
                      ))}
                    </HStack>
                  </ScrollView>
                </VStack>

                {/* Descrição */}
                <VStack space="xs">
                  <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Descrição (Opcional)</Text>
                  <Input variant="outline" size="xl" className={theme.inputCls}>
                    <InputField
                      placeholder="Ex: Conta de luz, Almoço..."
                      placeholderTextColor={theme.placeholder}
                      className={`${theme.text} text-sm`}
                      value={novaTransacao.descricao}
                      onChangeText={v => setNovaTransacao({ ...novaTransacao, descricao: v })}
                    />
                  </Input>
                </VStack>

                {/* Parcelamento — só para despesa */}
                {novaTransacao.tipo === 'despesa' && (
                  <VStack space="sm">
                    <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Parcelamento</Text>
                    <Button
                      className={`rounded-2xl py-3 h-auto border-2 justify-center items-center ${novaTransacao.parcelar ? 'border-amber-500 bg-amber-500/10' : `${theme.borderInactive} bg-transparent`}`}
                      onPress={() => setNovaTransacao({ ...novaTransacao, parcelar: !novaTransacao.parcelar })}
                    >
                      <ButtonText className={novaTransacao.parcelar ? 'text-amber-400 font-bold' : `${theme.textSubtle} font-medium`}>
                        {novaTransacao.parcelar ? ' Parcelado ativo' : ' Parcelar compra'}
                      </ButtonText>
                    </Button>
                    {novaTransacao.parcelar && (
                      <HStack space="sm" className="items-center">
                        <Text className={`text-sm flex-1 ${theme.textMuted}`}>Número de parcelas</Text>
                        <Input variant="outline" size="md" className={`${theme.inputCls} w-24`}>
                          <InputField
                            placeholder="Ex: 12"
                            placeholderTextColor={theme.placeholder}
                            keyboardType="numeric"
                            className={`${theme.text} font-bold text-center`}
                            value={novaTransacao.numeroParcelas}
                            onChangeText={v => setNovaTransacao({ ...novaTransacao, numeroParcelas: v.replace(/\D/g, '') })}
                          />
                        </Input>
                      </HStack>
                    )}
                    {novaTransacao.parcelar && novaTransacao.valor && novaTransacao.numeroParcelas > 0 && (
                      <Text className={`text-xs ${theme.textSubtle} text-center`}>
                        {novaTransacao.numeroParcelas}x de {formatarMoeda(parseFloat(novaTransacao.valor) / parseInt(novaTransacao.numeroParcelas || '1', 10))}
                      </Text>
                    )}
                  </VStack>
                )}

                {/* Recorrência — só para receita */}
                {novaTransacao.tipo === 'receita' && (
                  <VStack space="sm">
                    <Text className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>Recorrência</Text>
                    <Button
                      className={`rounded-2xl py-3 h-auto border-2 justify-center items-center ${novaTransacao.recorrente ? 'border-emerald-500 bg-emerald-500/10' : `${theme.borderInactive} bg-transparent`}`}
                      onPress={() => setNovaTransacao({ ...novaTransacao, recorrente: !novaTransacao.recorrente })}
                    >
                      <ButtonText className={novaTransacao.recorrente ? 'text-emerald-400 font-bold' : `${theme.textSubtle} font-medium`}>
                        {novaTransacao.recorrente ? 'Ganho fixo ativo' : 'Configurar como ganho fixo'}
                      </ButtonText>
                    </Button>
                    {novaTransacao.recorrente && (
                      <HStack space="sm" className="items-center">
                        <Text className={`text-sm flex-1 ${theme.textMuted}`}>Repetir por (meses)</Text>
                        <Input variant="outline" size="md" className={`${theme.inputCls} w-24`}>
                          <InputField
                            placeholder="Ex: 12"
                            placeholderTextColor={theme.placeholder}
                            keyboardType="numeric"
                            className={`${theme.text} font-bold text-center`}
                            value={novaTransacao.mesesRecorrencia}
                            onChangeText={v => setNovaTransacao({ ...novaTransacao, mesesRecorrencia: v.replace(/\D/g, '') })}
                          />
                        </Input>
                      </HStack>
                    )}
                  </VStack>
                )}

                {/* Confirmar */}
                <Button
                  size="xl"
                  className="w-full rounded-2xl bg-blue-600 active:bg-blue-700 py-4 h-auto shadow-lg mt-4"
                  onPress={handleAdicionar}
                  isDisabled={submitting}
                >
                  {submitting ? (
                    <Spinner className="text-white" />
                  ) : (
                    <ButtonText className="text-white font-extrabold text-base h-auto tracking-wide">
                      {novaTransacao.parcelar && novaTransacao.numeroParcelas > 1
                        ? `PARCELAR EM ${novaTransacao.numeroParcelas}X`
                        : novaTransacao.recorrente && novaTransacao.mesesRecorrencia > 1
                        ? `REGISTRAR ${novaTransacao.mesesRecorrencia} MESES`
                        : 'CONFIRMAR REGISTRO'}
                    </ButtonText>
                  )}
                </Button>

              </VStack>
            </ScrollView>
          </Box>
        </Box>
      </Modal>

    </SafeAreaView>
  );
}
