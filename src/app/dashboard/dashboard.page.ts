import { Component, OnInit, OnDestroy } from '@angular/core';
import { Api } from '../api';
import { interval, Subscription } from 'rxjs';

interface SensorData {
  nome: string;
  nivel: number;
  umidade: number;
  timestamp: string;
}

interface GraficoData {
  indice: number;
  nivel: number;
  umidade: number;
  sensor: string;
  hora: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {

  constructor(private apiService: Api) { }

  dados: any[] = [];
  dadosFiltrados: any[] = [];
  dadosFiltradosVisiveis: any[] = [];
  mostrarTodos: boolean = false;
  dataSelecionada: string = '';
  exibirCalendario: boolean = false;
  dataMaxima: string = new Date().toISOString();

  // Dados para o gráfico
  dadosGrafico: GraficoData[] = [];
  
  // Estatísticas
  tempMedia: number = 0;
  tempMaxima: number = 0;
  tempMinima: number = 0;
  umidadeMedia: number = 0;

  private atualizacaoAutomatica!: Subscription;

  ngOnInit() {
    // Define a data de hoje como padrão
    this.dataSelecionada = new Date().toISOString();

    // Carrega os dados imediatamente
    this.carregarDados();

    // Atualiza automaticamente a cada 10 segundos
    this.atualizacaoAutomatica = interval(10000).subscribe(() => {
      console.log('🔄 Atualizando dados automaticamente...');
      this.carregarDados();
    });
  }

  ngOnDestroy() {
    if (this.atualizacaoAutomatica) {
      this.atualizacaoAutomatica.unsubscribe();
    }
  }

  carregarDados(): any {
    this.apiService.getSensores().subscribe({
      next: (data: any[]) => {
        console.log('Dados recebidos da API:', data);
        this.dados = data;
        // Mostra todos os dados inicialmente
        this.dadosFiltrados = data;
        // Filtra os dados após carregar se houver data selecionada
        if (this.dataSelecionada) {
          this.filtrarPorData(this.dataSelecionada);
        }
        // Atualiza a lista visível
        this.atualizarListaVisivel();
        // Atualiza o gráfico com os novos dados
        this.atualizarGrafico();
      }, error: (err) => {
        console.log('Erro ao carregar dados:', err);
      }
    });
  }

  filtrarPorData(dataISO: string) {
    if (!dataISO || this.dados.length === 0) {
      this.dadosFiltrados = this.dados;
      console.log('Sem filtro aplicado. Total de dados:', this.dados.length);
      this.atualizarListaVisivel();
      this.atualizarGrafico();
      return;
    }

    const dataSelecionada = new Date(dataISO);
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    console.log('Filtrando por data:', dataFormatada);

    this.dadosFiltrados = this.dados.filter(item => {
      if (item.timestamp) {
        const dataItemString = item.timestamp.split(',')[0].trim();
        return dataItemString === dataFormatada;
      }
      return false;
    });

    console.log(`Dados filtrados para ${dataFormatada}:`, this.dadosFiltrados.length);
    this.atualizarListaVisivel();
    this.atualizarGrafico();
  }

  atualizarGrafico() {
    // Transforma os dados filtrados para o formato do gráfico
    this.dadosGrafico = this.dadosFiltrados.map((item, index) => ({
      indice: index + 1,
      nivelratura: parseFloat(item.nivelratura?.toString() || '0'),
      umidade: parseFloat(item.umidade?.toString() || '0'),
      sensor: item.nome || `Sensor ${index + 1}`,
      hora: this.extrairHora(item.timestamp)
    }));

    // Calcula as estatísticas
    this.calcularEstatisticas();

    console.log('Dados do gráfico atualizados:', this.dadosGrafico);
  }

  calcularEstatisticas() {
    if (this.dadosGrafico.length === 0) {
      this.tempMedia = 0;
      this.tempMaxima = 0;
      this.tempMinima = 0;
      this.umidadeMedia = 0;
      return;
    }

    const nivelraturas = this.dadosGrafico.map(d => d.nivelratura);
    const umidades = this.dadosGrafico.map(d => d.umidade);

    this.tempMedia = parseFloat((nivelraturas.reduce((a, b) => a + b, 0) / nivelraturas.length).toFixed(1));
    this.tempMaxima = Math.max(...nivelraturas);
    this.tempMinima = Math.min(...nivelraturas);
    this.umidadeMedia = parseFloat((umidades.reduce((a, b) => a + b, 0) / umidades.length).toFixed(1));
  }

  extrairHora(timestamp: string): string {
    if (!timestamp) return '';
    // Formato: "23/10/2025, 14:45:35" -> "14:45"
    const partes = timestamp.split(',');
    if (partes.length > 1) {
      const hora = partes[1].trim().split(':');
      return `${hora[0]}:${hora[1]}`;
    }
    return '';
  }

  onDataChange(event: any) {
    this.dataSelecionada = event.detail.value;
    this.filtrarPorData(this.dataSelecionada);
    this.exibirCalendario = false;
  }

  toggleCalendario() {
    this.exibirCalendario = !this.exibirCalendario;
  }

  limparFiltro() {
    this.dataSelecionada = '';
    this.dadosFiltrados = this.dados;
    this.atualizarListaVisivel();
    this.atualizarGrafico();
    this.exibirCalendario = false;
    console.log('Filtro removido. Mostrando todos os dados:', this.dadosFiltrados.length);
  }

  toggleMostrarMais() {
    this.mostrarTodos = !this.mostrarTodos;
    this.atualizarListaVisivel();
  }

  atualizarListaVisivel() {
    if (this.mostrarTodos) {
      this.dadosFiltradosVisiveis = this.dadosFiltrados;
    } else {
      this.dadosFiltradosVisiveis = this.dadosFiltrados.slice(0, 2);
    }
  }

  formatarData(dataISO: string): string {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  formatarDataHora(timestampBR: string): string {
    if (!timestampBR) return '';
    return timestampBR;
  }

  // Gera os pontos do gráfico de nivelratura
  gerarPontosnivelratura(): string {
    return this.gerarPontos('nivelratura', 30);
  }

  // Gera os pontos do gráfico de umidade
  gerarPontosUmidade(): string {
    return this.gerarPontos('umidade', 100);
  }

  // Método auxiliar para gerar pontos
  private gerarPontos(tipo: 'nivelratura' | 'umidade', valorMax: number): string {
    if (this.dadosGrafico.length === 0) return '';

    const pontos: string[] = [];
    const largura = 340;
    const altura = 140;
    const espacamento = largura / (this.dadosGrafico.length + 1);
    const margemEsquerda = 40;
    const margemTop = 20;

    this.dadosGrafico.forEach((item, index) => {
      const valor = item[tipo];
      const x = margemEsquerda + (index + 1) * espacamento;
      const y = margemTop + altura - (valor / valorMax) * altura;
      pontos.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });

    return pontos.join(' ');
  }

  // Obtém a cor baseada no valor de nivelratura
  getCornivelratura(temp: number): string {
    if (temp < 15) return '#3b82f6'; // Azul frio
    if (temp < 20) return '#10b981'; // Verde
    if (temp < 25) return '#f59e0b'; // Amarelo
    return '#ef4444'; // Vermelho quente
  }

  // Obtém a cor baseada no valor de umidade
  getCorUmidade(umidade: number): string {
    if (umidade < 30) return '#ef4444'; // Vermelho seco
    if (umidade < 50) return '#f59e0b'; // Amarelo
    if (umidade < 70) return '#3b82f6'; // Azul
    return '#10b981'; // Verde úmido
  }
}