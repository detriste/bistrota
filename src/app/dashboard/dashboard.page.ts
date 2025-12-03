import { Component, OnInit, OnDestroy } from '@angular/core';
import { Api } from '../api';
import { interval, Subscription } from 'rxjs';

interface SensorData {
  nome: string;
  nivel: number;
  umidade: number;
  turbidez: number;
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

  constructor(private apiService: Api) {}

  dados: any[] = [];
  dadosFiltrados: any[] = [];
  dadosFiltradosVisiveis: any[] = [];
  mostrarTodos: boolean = false;
  dataSelecionada: string = '';
  exibirCalendario: boolean = false;
  dataMaxima: string = new Date().toISOString();

  // Dados para o gráfico
  dadosGrafico: GraficoData[] = [];

  // Estatísticas de nível
  nivelMedio: number = 0;
  nivelMaximo: number = 0;
  nivelMinimo: number = 0;

  // Estatística de umidade
  umidadeMedia: number = 0;

  private atualizacaoAutomatica!: Subscription;

  ngOnInit() {
    this.dataSelecionada = new Date().toISOString();
    this.carregarDados();

    // Atualização automática
    this.atualizacaoAutomatica = interval(10000).subscribe(() => {
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
        this.dados = data;
        this.dadosFiltrados = data;

        if (this.dataSelecionada) {
          this.filtrarPorData(this.dataSelecionada);
        }

        this.atualizarListaVisivel();
        this.atualizarGrafico();
      },
      error: (err) => {
        console.log('Erro ao carregar dados:', err);
      }
    });
  }

  filtrarPorData(dataISO: string) {
    if (!dataISO || this.dados.length === 0) {
      this.dadosFiltrados = this.dados;
      this.atualizarListaVisivel();
      this.atualizarGrafico();
      return;
    }

    const dataSelecionada = new Date(dataISO);
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataFormatada = `${dia}/${mes}/${ano}`;

    this.dadosFiltrados = this.dados.filter(item => {
      if (item.timestamp) {
        const dataItemString = item.timestamp.split(',')[0].trim();
        return dataItemString === dataFormatada;
      }
      return false;
    });

    this.atualizarListaVisivel();
    this.atualizarGrafico();
  }

  atualizarGrafico() {
    this.dadosGrafico = this.dadosFiltrados.map((item, index) => ({
      indice: index + 1,
      nivel: parseFloat(item.nivel?.toString() || '0'),
      umidade: parseFloat(item.umidade?.toString() || '0'),
      sensor: item.nome || `Sensor ${index + 1}`,
      hora: this.extrairHora(item.timestamp)
    }));

    this.calcularEstatisticas();
  }

  calcularEstatisticas() {
    if (this.dadosGrafico.length === 0) {
      this.nivelMedio = 0;
      this.nivelMaximo = 0;
      this.nivelMinimo = 0;
      this.umidadeMedia = 0;
      return;
    }

    const niveis = this.dadosGrafico.map(d => d.nivel);
    const umidades = this.dadosGrafico.map(d => d.umidade);

    this.nivelMedio = parseFloat((niveis.reduce((a, b) => a + b, 0) / niveis.length).toFixed(1));
    this.nivelMaximo = Math.max(...niveis);
    this.nivelMinimo = Math.min(...niveis);
    this.umidadeMedia = parseFloat((umidades.reduce((a, b) => a + b, 0) / umidades.length).toFixed(1));
  }

  extrairHora(timestamp: string): string {
    if (!timestamp) return '';
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

  // Gráfico linha do nível
  gerarPontosNivel(): string {
    return this.gerarPontos('nivel', 100); // ajuste se o nível for outro máximo
  }

  // Gráfico linha da umidade
  gerarPontosUmidade(): string {
    return this.gerarPontos('umidade', 100);
  }

  private gerarPontos(tipo: 'nivel' | 'umidade', valorMax: number): string {
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

  getCorNivel(nivel: number): string {
    if (nivel < 30) return '#ef4444'; // baixo
    if (nivel < 60) return '#f59e0b'; // médio
    return '#10b981'; // bom
  }

  getCorUmidade(umidade: number): string {
    if (umidade < 30) return '#ef4444';
    if (umidade < 50) return '#f59e0b';
    if (umidade < 70) return '#3b82f6';
    return '#10b981';
  }
}
