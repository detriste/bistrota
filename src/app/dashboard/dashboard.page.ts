import { Component, OnInit, OnDestroy } from '@angular/core';
import { Api } from '../api';
import { interval, Subscription } from 'rxjs';

interface SensorData {
  nome: string;
  nivel: number;
  ph: number;
  turbidez: number;
  timestamp: string;
}

interface GraficoData {
  nivel: number;
  ph: number;
  turbidez: number;
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
  dados: SensorData[] = [];
  dadosFiltrados: SensorData[] = [];
  dadosFiltradosVisiveis: SensorData[] = [];
  dadosGrafico: GraficoData[] = [];
  mostrarTodos = false;
  dataSelecionada = '';
  exibirCalendario = false;
  dataMaxima = new Date().toISOString();

  nivelMedia = 0;
  phMedia = 0;
  turbidezMedia = 0;

  tooltipVisivel = false;
  tooltipX = 0;
  tooltipY = 0;
  tooltipValor = 0;
  tooltipUnidade = '';
  tooltipSensor = '';
  tooltipHora = '';

  private sub!: Subscription;

  constructor(private apiService: Api) {}

  ngOnInit() {
    this.carregarDados();
    this.sub = interval(10000).subscribe(() => this.carregarDados());
  }

  ngOnDestroy() { 
    this.sub?.unsubscribe(); 
  }

  carregarDados() {
    this.apiService.getSensores().subscribe((data: any[]) => {
      this.dados = data as SensorData[];
      this.dadosFiltrados = [...this.dados];
      
      if (this.dataSelecionada) {
        this.filtrarPorData(this.dataSelecionada);
      } else {
        this.atualizarListaVisivel();
      }
    });
  }

  filtrarPorData(iso: string) {
    const d = new Date(iso);
    const str = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    this.dadosFiltrados = this.dados.filter(x => x.timestamp?.startsWith(str));
    this.atualizarListaVisivel();
  }

  atualizarListaVisivel() {
    // Define quais sensores serão visíveis na lista
    this.dadosFiltradosVisiveis = this.mostrarTodos 
      ? this.dadosFiltrados 
      : this.dadosFiltrados.slice(0, 2);
    
    // ATUALIZA O GRÁFICO COM BASE NOS DADOS VISÍVEIS
    this.atualizarGrafico();
  }

  atualizarGrafico() {
    // Usa TODOS os dados filtrados para o gráfico (não só os visíveis)
    this.dadosGrafico = this.dadosFiltrados.map((item, i) => ({
      nivel: +item.nivel || 0,
      ph: +item.ph || 7,
      turbidez: +item.turbidez || 0,
      sensor: item.nome || `Sensor ${i+1}`,
      hora: item.timestamp?.split(',')[1]?.trim().substring(0,5) || ''
    }));

    const n = this.dadosGrafico.map(x => x.nivel);
    const p = this.dadosGrafico.map(x => x.ph);
    const t = this.dadosGrafico.map(x => x.turbidez);

    this.nivelMedia = n.length ? +(n.reduce((a,b)=>a+b)/n.length).toFixed(1) : 0;
    this.phMedia = p.length ? +(p.reduce((a,b)=>a+b)/p.length).toFixed(2) : 0;
    this.turbidezMedia = t.length ? +(t.reduce((a,b)=>a+b)/t.length).toFixed(1) : 0;
  }

  // Obtém o valor máximo de turbidez para escala dinâmica
  getMaxTurbidez(): number {
    if (!this.dadosGrafico.length) return 100;
    const max = Math.max(...this.dadosGrafico.map(d => d.turbidez));
    // Arredonda para cima para o próximo múltiplo de 10
    return Math.ceil(max / 10) * 10 || 100;
  }

  // Gráficos - Geração de pontos para os SVGs
  gerarPontosNivel() { 
    return this.gerarPontos('nivel', 100); 
  }
  
  gerarPontosPh() { 
    return this.gerarPontos('ph', 14); 
  }
  
  gerarPontosTurbidez() { 
    return this.gerarPontos('turbidez', this.getMaxTurbidez()); 
  }

  private gerarPontos(campo: 'nivel'|'ph'|'turbidez', max: number) {
    if (!this.dadosGrafico.length) return '';
    
    return this.dadosGrafico.map((d, i) => {
      const x = 60 + i * (300 / (this.dadosGrafico.length - 1 || 1)); // melhor espaçamento
      let valor = campo === 'ph' ? d.ph : campo === 'turbidez' ? d.turbidez : d.nivel;
      
      // Para pH, ajusta a escala de 0-14 para começar do zero
      if (campo === 'ph') {
        valor = valor; // pH já está em escala 0-14
      }
      
      // Calcula Y: 160 é o fundo, 20 é o topo (140 pixels de altura útil)
      const y = 160 - (valor / max) * 140;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Cores inteligentes baseadas nos valores
  getCorNivel(v: number) { 
    return v < 30 ? '#ef4444' : v < 70 ? '#f59e0b' : '#10b981'; 
  }
  
  getCorPh(v: number) { 
    return v < 6.5 ? '#ef4444' : v > 8.5 ? '#3b82f6' : '#10b981'; 
  }
  
  getCorTurbidez(v: number) { 
    return v > 50 ? '#ef4444' : v > 20 ? '#f59e0b' : '#10b981'; 
  }

  // Métodos auxiliares para calcular posições Y dos círculos
  calcularCyNivel(valor: number): number {
    return 160 - (valor / 100) * 140;
  }

  calcularCyPh(valor: number): number {
    return 160 - (valor / 14) * 140;
  }

  calcularCyTurbidez(valor: number): number {
    return 160 - (valor / this.getMaxTurbidez()) * 140;
  }

  calcularCx(index: number): number {
    return 60 + index * (300 / (this.dadosGrafico.length - 1 || 1));
  }

  // Tooltip para exibir detalhes ao clicar nos pontos do gráfico
  mostrarTooltip(item: GraficoData, i: number, tipo: 'nivel'|'ph'|'turbidez') {
    let max = 100;
    if (tipo === 'ph') max = 14;
    else if (tipo === 'turbidez') max = this.getMaxTurbidez();
    
    let valor = tipo === 'ph' ? item.ph : tipo === 'turbidez' ? item.turbidez : item.nivel;

    this.tooltipValor = tipo === 'ph' ? parseFloat(valor.toFixed(2)) : valor;
    this.tooltipUnidade = tipo === 'ph' ? '' : tipo === 'turbidez' ? ' NTU' : ' %';
    this.tooltipSensor = item.sensor;
    this.tooltipHora = item.hora;
    
    // Usa o mesmo cálculo de X e Y dos pontos do gráfico
    this.tooltipX = 60 + i * (300 / (this.dadosGrafico.length - 1 || 1));
    this.tooltipY = 160 - (valor / max) * 140 + 60;
    this.tooltipVisivel = true;
  }

  esconderTooltip() { 
    this.tooltipVisivel = false; 
  }

  // Utilitários de controle de UI
  onDataChange(e: any) { 
    this.dataSelecionada = e.detail.value; 
    this.filtrarPorData(this.dataSelecionada); 
    this.exibirCalendario = false; 
  }
  
  limparFiltro() { 
    this.dataSelecionada = ''; 
    this.dadosFiltrados = [...this.dados]; 
    this.atualizarListaVisivel(); 
  }
  
  toggleCalendario() { 
    this.exibirCalendario = !this.exibirCalendario; 
  }
  
  toggleMostrarMais() { 
    this.mostrarTodos = !this.mostrarTodos; 
    this.atualizarListaVisivel(); // Isso agora atualiza o gráfico também!
  }
  
  // Formatação de datas
  formatarData(iso: string) { 
    const d = new Date(iso); 
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; 
  }
  
  formatarDataHora(ts: string) { 
    return ts || ''; 
  }
}