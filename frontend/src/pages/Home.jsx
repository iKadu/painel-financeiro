import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTheme } from '@/context/ThemeContext';
import {
  TrendingUp, TrendingDown, Wallet, LogOut, Moon, Sun,
  Plus, Trash2, ChevronLeft, ChevronRight, BarChart3,
  ArchiveRestore, ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CATEGORIAS = {
  receita: ['Salário', 'Freelance', 'Investimentos', 'Aluguel', 'Outros'],
  despesa: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer', 'Vestuário', 'Outros'],
};

function Home() {
  const [resumo, setResumo] = useState({ receitas: 0, despesas: 0, saldo: 0 });
  const [transacoes, setTransacoes] = useState([]);
  const [transacoesExcluidas, setTransacoesExcluidas] = useState([]);
  const [aba, setAba] = useState('ativas'); // 'ativas' | 'excluidas'
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
  
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dialogAberto, setDialogAberto] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const navigate = useNavigate();
  const nomeUsuario = localStorage.getItem('nome');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    carregarDados();
  }, [mes, ano]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resResumo, resTransacoes, resExcluidas] = await Promise.all([
        api.get(`/transacoes/resumo?mes=${mes}&ano=${ano}`),
        api.get(`/transacoes?mes=${mes}&ano=${ano}`),
        api.get(`/transacoes/excluidos?mes=${mes}&ano=${ano}`),
      ]);
      setResumo(resResumo.data);
      setTransacoes(resTransacoes.data);
      setTransacoesExcluidas(resExcluidas.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nome');
    navigate('/login');
  };

  const addMonths = (dateStr, months) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const handleAdicionar = async (e) => {
    e.preventDefault();
    const isParcelas = novaTransacao.tipo === 'despesa' && novaTransacao.parcelar;
    const isRecorrente = novaTransacao.tipo === 'receita' && novaTransacao.recorrente;
    const n = isParcelas ? parseInt(novaTransacao.numeroParcelas, 10) || 1
             : isRecorrente ? parseInt(novaTransacao.mesesRecorrencia, 10) || 1
             : 1;

    if ((isParcelas || isRecorrente) && (n < 1 || n > 60)) {
      alert('Informe um número entre 1 e 60.');
      return;
    }

    try {
      if (isParcelas) {
        const valorParcela = (parseFloat(novaTransacao.valor) / n).toFixed(2);
        for (let i = 0; i < n; i++) {
          await api.post('/transacoes', {
            tipo: 'despesa',
            categoria: novaTransacao.categoria,
            valor: valorParcela,
            descricao: `${novaTransacao.descricao ? novaTransacao.descricao + ' ' : ''}(${i + 1}/${n})`,
            data: addMonths(novaTransacao.data, i),
          });
        }
      } else if (isRecorrente) {
        for (let i = 0; i < n; i++) {
          await api.post('/transacoes', {
            tipo: 'receita',
            categoria: novaTransacao.categoria,
            valor: novaTransacao.valor,
            descricao: novaTransacao.descricao || '',
            data: addMonths(novaTransacao.data, i),
          });
        }
      } else {
        await api.post('/transacoes', {
          tipo: novaTransacao.tipo,
          categoria: novaTransacao.categoria,
          valor: novaTransacao.valor,
          descricao: novaTransacao.descricao,
          data: novaTransacao.data,
        });
      }
      setNovaTransacao({
        tipo: 'despesa', categoria: '', valor: '', descricao: '',
        data: new Date().toISOString().split('T')[0],
        parcelar: false, numeroParcelas: '2',
        recorrente: false, mesesRecorrencia: '12',
      });
      setDialogAberto(false);
      carregarDados();
    } catch {
      alert('Erro ao adicionar transação');
    }
  };

  const handleDeletar = async (id) => {
    try {
      await api.delete(`/transacoes/${id}`);
      carregarDados();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      alert('Erro ao remover transação: ' + (err.response?.data?.erro || err.message));
    }
  };

  const handleRestaurar = async (id) => {
    try {
      await api.patch(`/transacoes/${id}/restaurar`);
      carregarDados();
    } catch {
      alert('Erro ao restaurar transação');
    }
  };

  const mudarMes = (delta) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };
  
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = (data) => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'data') {
         aValue = new Date(a.data).getTime();
         bValue = new Date(b.data).getTime();
      } else if (sortConfig.key === 'valor') {
         aValue = Number(a.valor);
         bValue = Number(b.valor);
      } else {
         aValue = String(aValue || '').toLowerCase();
         bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Dados do gráfico
  const dadosGrafico = [
    { name: 'Receitas', valor: Number(resumo.receitas), fill: '#22c55e' },
    { name: 'Despesas', valor: Number(resumo.despesas), fill: '#ef4444' },
    { name: 'Saldo', valor: Math.abs(Number(resumo.saldo)), fill: resumo.saldo >= 0 ? '#8b5cf6' : '#f97316' },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-muted-foreground">{formatarMoeda(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    if (sortConfig.direction === 'asc') return <ChevronUp className="h-3 w-3 ml-1 inline-block" />;
    return <ChevronDown className="h-3 w-3 ml-1 inline-block" />;
  };

  const transacoesExibidas = getSortedData(aba === 'ativas' ? transacoes : transacoesExcluidas);

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(valor));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/25">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">Financiária</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, <span className="font-medium text-foreground">{nomeUsuario}</span>
            </span>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Alternar tema"
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />}
            </button>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Navegação de mês */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => mudarMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[140px]">
              <p className="font-semibold text-foreground text-lg">{MESES[mes - 1]}</p>
              <p className="text-sm text-muted-foreground">{ano}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => mudarMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Botão Nova Transação */}
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md shadow-primary/20">
                <Plus className="h-4 w-4 shrink-0" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
                <DialogDescription>
                  Adicione uma nova receita ou despesa ao seu controle financeiro.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdicionar} className="space-y-4 pt-2">
                {/* Tipo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={novaTransacao.tipo}
                      onValueChange={v => setNovaTransacao({ ...novaTransacao, tipo: v, categoria: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receita">💰 Receita</SelectItem>
                        <SelectItem value="despesa">💸 Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={novaTransacao.categoria}
                      onValueChange={v => setNovaTransacao({ ...novaTransacao, categoria: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(CATEGORIAS[novaTransacao.tipo] || []).map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Valor e Data */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      value={novaTransacao.valor}
                      onChange={e => setNovaTransacao({ ...novaTransacao, valor: e.target.value })}
                      required

                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data">Data</Label>
                    <Input
                      id="data"
                      type="date"
                      value={novaTransacao.data}
                      onChange={e => setNovaTransacao({ ...novaTransacao, data: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input
                    id="descricao"
                    type="text"
                    placeholder="Ex: Almoço no restaurante..."
                    value={novaTransacao.descricao}
                    onChange={e => setNovaTransacao({ ...novaTransacao, descricao: e.target.value })}
                  />
                </div>

                {/* Parcelamento — só para despesa */}
                {novaTransacao.tipo === 'despesa' && (
                  <div className="space-y-2">
                    <Label>Parcelamento</Label>
                    <button
                      type="button"
                      onClick={() => setNovaTransacao({ ...novaTransacao, parcelar: !novaTransacao.parcelar })}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium border-2 transition-colors ${
                        novaTransacao.parcelar
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {novaTransacao.parcelar ? '✓ Parcelado ativo' : 'Parcelar compra'}
                    </button>
                    {novaTransacao.parcelar && (
                      <div className="flex items-center gap-3">
                        <Label htmlFor="parcelas" className="flex-1 text-sm">Número de parcelas</Label>
                        <Input
                          id="parcelas"
                          type="number"
                          min="2"
                          max="60"
                          value={novaTransacao.numeroParcelas}
                          onChange={e => setNovaTransacao({ ...novaTransacao, numeroParcelas: e.target.value.replace(/\D/g, '') })}
                          className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}
                    {novaTransacao.parcelar && novaTransacao.valor && parseInt(novaTransacao.numeroParcelas, 10) > 0 && (
                      <p className="text-xs text-center text-muted-foreground">
                        {novaTransacao.numeroParcelas}x de {formatarMoeda(parseFloat(novaTransacao.valor) / (parseInt(novaTransacao.numeroParcelas, 10) || 1))}
                      </p>
                    )}
                  </div>
                )}

                {/* Recorrência — só para receita */}
                {novaTransacao.tipo === 'receita' && (
                  <div className="space-y-2">
                    <Label>Receita Fixa</Label>
                    <button
                      type="button"
                      onClick={() => setNovaTransacao({ ...novaTransacao, recorrente: !novaTransacao.recorrente })}
                      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium border-2 transition-colors ${
                        novaTransacao.recorrente
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {novaTransacao.recorrente ? '✓ Ganho fixo ativo' : 'Configurar como ganho fixo'}
                    </button>
                    {novaTransacao.recorrente && (
                      <div className="flex items-center gap-3">
                        <Label htmlFor="meses" className="flex-1 text-sm">Repetir por (meses)</Label>
                        <Input
                          id="meses"
                          type="number"
                          min="2"
                          max="60"
                          value={novaTransacao.mesesRecorrencia}
                          onChange={e => setNovaTransacao({ ...novaTransacao, mesesRecorrencia: e.target.value.replace(/\D/g, '') })}
                          className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogAberto(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={!novaTransacao.categoria || !novaTransacao.valor}
                  >
                    {novaTransacao.parcelar && parseInt(novaTransacao.numeroParcelas, 10) > 1
                      ? `Parcelar em ${novaTransacao.numeroParcelas}x`
                      : novaTransacao.recorrente && parseInt(novaTransacao.mesesRecorrencia, 10) > 1
                      ? `Registrar por ${novaTransacao.mesesRecorrencia} meses`
                      : 'Adicionar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-green-500/20 dark:border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">Receitas</p>
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatarMoeda(resumo.receitas)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 dark:border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatarMoeda(resumo.despesas)}
              </p>
            </CardContent>
          </Card>

          <Card className={resumo.saldo >= 0 ? 'border-primary/30' : 'border-orange-500/20'}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">Saldo</p>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${resumo.saldo >= 0 ? 'bg-primary/10' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                  <Wallet className={`h-4 w-4 ${resumo.saldo >= 0 ? 'text-primary' : 'text-orange-600 dark:text-orange-400'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-primary' : 'text-orange-600 dark:text-orange-400'}`}>
                {formatarMoeda(resumo.saldo)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Visão Geral do Mês</CardTitle>
            </div>
            <CardDescription>{MESES[mes - 1]} de {ano}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dadosGrafico} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `R$${v}`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={80} minPointSize={4} activeBar={false}>
                  {dadosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabela de Transações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Transações</CardTitle>
                <CardDescription>
                  {transacoesExibidas.length === 0
                    ? 'Nenhuma transação neste período.'
                    : `${transacoesExibidas.length} transaç${transacoesExibidas.length === 1 ? 'ão' : 'ões'}.`}
                </CardDescription>
              </div>
            </div>
            
            {/* Tabs de Status */}
            <div className="flex items-center gap-6 mt-4 pt-2 border-b border-border/50">
              <button 
                className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${aba === 'ativas' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setAba('ativas')}
              >
                Ativas
                <span className={`text-xs px-2 py-0.5 rounded-full ${aba === 'ativas' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {transacoes.length}
                </span>
              </button>
              <button 
                className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${aba === 'excluidas' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setAba('excluidas')}
              >
                Excluídas
                <span className={`text-xs px-2 py-0.5 rounded-full ${aba === 'excluidas' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {transacoesExcluidas.length}
                </span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {transacoesExibidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Wallet className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">
                  {aba === 'ativas' ? 'Adicione sua primeira transação!' : 'Nenhuma transação excluída.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none hover:text-foreground transition-colors group" 
                      onClick={() => handleSort('data')}
                    >
                      Data <SortIcon columnKey="data" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:text-foreground transition-colors group"
                      onClick={() => handleSort('categoria')}
                    >
                      Categoria <SortIcon columnKey="categoria" />
                    </TableHead>
                    <TableHead 
                      className="hidden sm:table-cell cursor-pointer select-none hover:text-foreground transition-colors group"
                      onClick={() => handleSort('descricao')}
                    >
                      Descrição <SortIcon columnKey="descricao" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:text-foreground transition-colors group"
                      onClick={() => handleSort('tipo')}
                    >
                      Tipo <SortIcon columnKey="tipo" />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer select-none hover:text-foreground transition-colors group"
                      onClick={() => handleSort('valor')}
                    >
                      Valor <SortIcon columnKey="valor" />
                    </TableHead>
                    <TableHead className="w-16 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoesExibidas.map(t => (
                    <TableRow key={t.id} className={aba === 'excluidas' ? 'opacity-75 bg-muted/20' : ''}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(t.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell className="font-medium">{t.categoria}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {t.descricao || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.tipo === 'receita' ? 'success' : 'warning'}>
                          {t.tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${t.tipo === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {t.tipo === 'receita' ? '+' : '-'} {formatarMoeda(t.valor).replace(/^R\$\s*/, 'R$ ')}
                      </TableCell>
                      <TableCell className="text-center">
                        {aba === 'ativas' ? (
                          <Button
                            title="Mover para lixeira"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletar(t.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            title="Restaurar transação"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRestaurar(t.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default Home;
