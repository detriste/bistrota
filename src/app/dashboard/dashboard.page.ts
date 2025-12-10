import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Api } from '../api';
import { interval, Subscription, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, retry, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { of } from 'rxjs';

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

interface Estatisticas {
  nivelMedia: number;
  phMedia: number;
  turbidezMedia: number;
  nivelMin: number;
  nivelMax: number;
  phMin: number;
  phMax: number;
  turbidezMin: number;
  turbidezMax: number;
}

type TipoMetrica = 'nivel' | 'ph' | 'turbidez';

interface TooltipConfig {
  visivel: boolean;
  x: number;
  y: number;
  valor: number | string;
  unidade: string;
  sensor: string;
  hora: string;
  status: string;
  cor: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {
  // Estado da aplicação
  dados: SensorData[] = [];
  dadosFiltrados: SensorData[] = [];
  dadosFiltradosVisiveis: SensorData[] = [];
  dadosGrafico: GraficoData[] = [];
  
  // Controles de UI
  mostrarTodos = false;
  dataSelecionada = '';
  exibirCalendario = false;
  dataMaxima = new Date().toISOString();
  carregando = false;
  erro = '';

  // Estatísticas
  stats: Estatisticas = this.criarEstatisticasVazias();

  // Tooltip otimizado
  tooltip: TooltipConfig = {
    visivel: false,
    x: 0,
    y: 0,
    valor: 0,
    unidade: '',
    sensor: '',
    hora: '',
    status: '',
    cor: ''
  };

  // Constantes
  private readonly ITEMS_POR_PAGINA = 3;
  private readonly INTERVALO_ATUALIZACAO = 10000; // 10 segundos
  private readonly MAX_PONTOS_GRAFICO = 10;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly TOOLTIP_WIDTH = 160;
  private readonly TOOLTIP_OFFSET = 20;

  // Thresholds para avaliação
  private readonly THRESHOLDS = {
    nivel: { critico: 20, baixo: 40, moderado: 60, bom: 80 },
    ph: { minimo: 6.0, atencaoMin: 6.5, atencaoMax: 8.0, maximo: 8.5 },
    turbidez: { baixa: 10, moderada: 20, alta: 50, muitoAlta: 100 }
  };

  // Dimensões do gráfico
  private readonly GRAFICO = {
    larguraUtil: 340,
    alturaUtil: 140,
    offsetX: 60,
    offsetY: 160
  };

  private subscriptions = new Subscription();
  private dataSelecionadaSubject = new BehaviorSubject<string>('');

  constructor(private apiService: Api) {}

  ngOnInit(): void {
    this.carregarDados();
    this.iniciarAtualizacaoAutomatica();
    this.configurarFiltroPorData();
  }

  ngOnDestroy(): void { 
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.chart-point') && !target.closest('.tooltip-balloon')) {
      this.esconderTooltip();
    }
  }

  @HostListener('window:scroll', ['$event'])
  @HostListener('ionScroll', ['$event'])
  onScroll(): void {
    this.esconderTooltip();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.chart-point') && !target.closest('.tooltip-balloon')) {
      this.esconderTooltip();
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(): void {
    this.esconderTooltip();
  }

  // ==================== CARREGAMENTO DE DADOS ====================

  private iniciarAtualizacaoAutomatica(): void {
    const subscription = interval(this.INTERVALO_ATUALIZACAO)
      .pipe(
        switchMap(() => this.apiService.getSensores()),
        retry(this.RETRY_ATTEMPTS),
        catchError(err => this.handleError(err, 'Erro ao atualizar dados automaticamente'))
      )
      .subscribe((data: SensorData[]) => {
        if (data?.length > 0) {
          this.dados = data;
          this.atualizarDadosFiltrados();
          this.erro = '';
        }
      });

    this.subscriptions.add(subscription);
  }

  carregarDados(): void {
    this.carregando = true;
    this.erro = '';
    
    const subscription = this.apiService.getSensores()
      .pipe(
        retry(2),
        catchError(err => this.handleError(err, 'Não foi possível carregar os dados. Verifique sua conexão.'))
      )
      .subscribe((data: SensorData[]) => {
        this.dados = data || [];
        this.atualizarDadosFiltrados();
        this.carregando = false;
      });

    this.subscriptions.add(subscription);
  }

  private handleError(err: any, mensagem: string) {
    console.error(mensagem, err);
    this.erro = mensagem;
    this.carregando = false;
    return of([]);
  }

  // ==================== FILTRAGEM E ATUALIZAÇÃO ====================

  private configurarFiltroPorData(): void {
    const subscription = this.dataSelecionadaSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(data => {
        if (data) {
          this.filtrarPorData(data);
        } else {
          this.atualizarDadosFiltrados();
        }
      });

    this.subscriptions.add(subscription);
  }

  private atualizarDadosFiltrados(): void {
    this.dadosFiltrados = this.ordenarPorDataDecrescente([...this.dados]);
    this.atualizarListaVisivel();
  }

  private ordenarPorDataDecrescente(dados: SensorData[]): SensorData[] {
    return dados.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  filtrarPorData(iso: string): void {
    const dataFormatada = this.formatarDataParaComparacao(iso);
    
    this.dadosFiltrados = this.dados
      .filter(x => x.timestamp?.startsWith(dataFormatada))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    this.atualizarListaVisivel();
  }

  private formatarDataParaComparacao(iso: string): string {
    const d = new Date(iso);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  atualizarListaVisivel(): void {
    this.dadosFiltradosVisiveis = this.mostrarTodos 
      ? this.dadosFiltrados 
      : this.dadosFiltrados.slice(0, this.ITEMS_POR_PAGINA);
    
    this.atualizarGrafico();
  }

  // ==================== GRÁFICO ====================

  atualizarGrafico(): void {
    const dadosParaGrafico = this.dadosFiltrados
      .slice(0, this.MAX_PONTOS_GRAFICO)
      .reverse();
    
    this.dadosGrafico = dadosParaGrafico.map((item, i) => ({
      nivel: this.sanitizeNumber(item.nivel, 0, 100),
      ph: this.sanitizeNumber(item.ph, 0, 14),
      turbidez: this.sanitizeNumber(item.turbidez, 0, 1000),
      sensor: item.nome || `Sensor ${i + 1}`,
      hora: this.extrairHora(item.timestamp)
    }));

    this.calcularEstatisticas();
  }

  private sanitizeNumber(value: any, min: number, max: number): number {
    const num = Number(value) || 0;
    return Math.max(min, Math.min(max, num));
  }

  private extrairHora(timestamp: string): string {
    if (!timestamp) return '';
    const parts = timestamp.split(',');
    return parts[1]?.trim().substring(0, 5) || '';
  }

  gerarPontosNivel(): string { 
    return this.gerarPontos('nivel', 100); 
  }
  
  gerarPontosPh(): string { 
    return this.gerarPontos('ph', 14); 
  }
  
  gerarPontosTurbidez(): string { 
    return this.gerarPontos('turbidez', this.getMaxTurbidez()); 
  }

  private gerarPontos(campo: TipoMetrica, max: number): string {
    if (!this.dadosGrafico.length) return '';
    
    const espacamento = this.dadosGrafico.length > 1 
      ? this.GRAFICO.larguraUtil / (this.dadosGrafico.length - 1) 
      : 0;
    
    return this.dadosGrafico.map((d, i) => {
      const x = this.GRAFICO.offsetX + (i * espacamento);
      const valor = d[campo];
      const y = this.GRAFICO.offsetY - ((valor / max) * this.GRAFICO.alturaUtil);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // ==================== CÁLCULOS DE POSIÇÃO ====================

  calcularCx(index: number): number {
    if (this.dadosGrafico.length <= 1) return 200;
    return this.GRAFICO.offsetX + (index * (this.GRAFICO.larguraUtil / (this.dadosGrafico.length - 1)));
  }

  calcularCyNivel(valor: number): number {
    return this.GRAFICO.offsetY - ((valor / 100) * this.GRAFICO.alturaUtil);
  }

  calcularCyPh(valor: number): number {
    return this.GRAFICO.offsetY - ((valor / 14) * this.GRAFICO.alturaUtil);
  }

  calcularCyTurbidez(valor: number): number {
    return this.GRAFICO.offsetY - ((valor / this.getMaxTurbidez()) * this.GRAFICO.alturaUtil);
  }

  // ==================== ESTATÍSTICAS ====================

  private calcularEstatisticas(): void {
    if (!this.dadosGrafico.length) {
      this.stats = this.criarEstatisticasVazias();
      return;
    }

    const niveis = this.dadosGrafico.map(x => x.nivel);
    const phs = this.dadosGrafico.map(x => x.ph);
    const turbidezes = this.dadosGrafico.map(x => x.turbidez);

    this.stats = {
      nivelMedia: this.calcularMedia(niveis),
      phMedia: this.calcularMedia(phs),
      turbidezMedia: this.calcularMedia(turbidezes),
      nivelMin: Math.min(...niveis),
      nivelMax: Math.max(...niveis),
      phMin: Math.min(...phs),
      phMax: Math.max(...phs),
      turbidezMin: Math.min(...turbidezes),
      turbidezMax: Math.max(...turbidezes)
    };
  }

  private calcularMedia(valores: number[]): number {
    if (!valores.length) return 0;
    return valores.reduce((acc, val) => acc + val, 0) / valores.length;
  }

  private criarEstatisticasVazias(): Estatisticas {
    return {
      nivelMedia: 0, phMedia: 0, turbidezMedia: 0,
      nivelMin: 0, nivelMax: 0,
      phMin: 0, phMax: 0,
      turbidezMin: 0, turbidezMax: 0
    };
  }

  // Getters para template
  get nivelMedia(): number { return this.stats.nivelMedia; }
  get phMedia(): number { return this.stats.phMedia; }
  get turbidezMedia(): number { return this.stats.turbidezMedia; }

  getMaxTurbidez(): number {
    if (!this.dadosGrafico.length) return 100;
    const max = Math.max(...this.dadosGrafico.map(d => d.turbidez));
    return Math.max(100, Math.ceil(max / 50) * 50);
  }

  // ==================== CORES E STATUS ====================

  getCorNivel(v: number): string { 
    const { critico, baixo, moderado, bom } = this.THRESHOLDS.nivel;
    if (v < critico) return '#dc2626';
    if (v < baixo) return '#ef4444';
    if (v < moderado) return '#f59e0b';
    if (v < bom) return '#84cc16';
    return '#10b981';
  }
  
  getCorPh(v: number): string { 
    const { minimo, atencaoMin, atencaoMax, maximo } = this.THRESHOLDS.ph;
    if (v < minimo) return '#ef4444';
    if (v < atencaoMin) return '#f59e0b';
    if (v > maximo) return '#3b82f6';
    if (v > atencaoMax) return '#06b6d4';
    return '#10b981';
  }
  
  getCorTurbidez(v: number): string { 
    const { baixa, moderada, alta, muitoAlta } = this.THRESHOLDS.turbidez;
    if (v > muitoAlta) return '#dc2626';
    if (v > alta) return '#ef4444';
    if (v > moderada) return '#f59e0b';
    if (v > baixa) return '#84cc16';
    return '#10b981';
  }

  getStatusNivel(v: number): string {
    const { critico, baixo, moderado, bom } = this.THRESHOLDS.nivel;
    if (v < critico) return 'Crítico';
    if (v < baixo) return 'Baixo';
    if (v < moderado) return 'Moderado';
    if (v < bom) return 'Bom';
    return 'Ótimo';
  }

  getStatusPh(v: number): string {
    const { minimo, atencaoMin, atencaoMax, maximo } = this.THRESHOLDS.ph;
    if (v < minimo || v > maximo) return 'Fora do padrão';
    if (v < atencaoMin || v > atencaoMax) return 'Atenção';
    return 'Normal';
  }

  getStatusTurbidez(v: number): string {
    const { moderada, alta, muitoAlta } = this.THRESHOLDS.turbidez;
    if (v > muitoAlta) return 'Muito alta';
    if (v > alta) return 'Alta';
    if (v > moderada) return 'Moderada';
    return 'Baixa';
  }

  // ==================== TOOLTIP ====================

  mostrarTooltip(item: GraficoData, i: number, tipo: TipoMetrica, event: MouseEvent): void {
    event.stopPropagation();
    
    const valor = item[tipo];
    const configuracao = this.obterConfiguracaoTooltip(valor, tipo);
    
    this.tooltip = {
      visivel: true,
      valor: configuracao.valor,
      unidade: configuracao.unidade,
      sensor: item.sensor,
      hora: item.hora,
      status: configuracao.status,
      cor: configuracao.cor,
      ...this.calcularPosicaoTooltip(event, i, tipo, valor)
    };
  }

  private obterConfiguracaoTooltip(valor: number, tipo: TipoMetrica) {
    const configs = {
      nivel: {
        valor: Math.round(valor),
        unidade: '%',
        status: this.getStatusNivel(valor),
        cor: this.getCorNivel(valor)
      },
      ph: {
        valor: valor.toFixed(2),
        unidade: '',
        status: this.getStatusPh(valor),
        cor: this.getCorPh(valor)
      },
      turbidez: {
        valor: Math.round(valor),
        unidade: ' NTU',
        status: this.getStatusTurbidez(valor),
        cor: this.getCorTurbidez(valor)
      }
    };

    return configs[tipo];
  }

  private calcularPosicaoTooltip(event: MouseEvent, i: number, tipo: TipoMetrica, valor: number): { x: number; y: number } {
    const svgElement = (event.target as HTMLElement).closest('svg');
    if (!svgElement) return { x: 0, y: 0 };
    
    const svgRect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox.baseVal;
    
    const cx = this.calcularCx(i);
    const cy = this.obterCyPorTipo(tipo, valor);
    
    const scaleX = svgRect.width / viewBox.width;
    const scaleY = svgRect.height / viewBox.height;
    
    // Usar posição relativa ao documento + scroll atual
    let x = (cx * scaleX) + svgRect.left + window.pageXOffset;
    const y = (cy * scaleY) + svgRect.top + window.pageYOffset - this.TOOLTIP_OFFSET;
    
    // Ajustar se sair da tela (considerando scroll)
    x = this.ajustarPosicaoX(x, window.pageXOffset);
    
    return { x, y };
  }

  private obterCyPorTipo(tipo: TipoMetrica, valor: number): number {
    const metodos = {
      nivel: () => this.calcularCyNivel(valor),
      ph: () => this.calcularCyPh(valor),
      turbidez: () => this.calcularCyTurbidez(valor)
    };
    return metodos[tipo]();
  }

  private ajustarPosicaoX(x: number, scrollX: number = 0): number {
    const halfWidth = this.TOOLTIP_WIDTH / 2;
    const margin = 10;
    const viewportWidth = window.innerWidth;
    
    // Considerar posição relativa à viewport atual
    const xRelativo = x - scrollX;
    
    if (xRelativo + halfWidth > viewportWidth) {
      return viewportWidth - halfWidth - margin + scrollX;
    }
    if (xRelativo - halfWidth < 0) {
      return halfWidth + margin + scrollX;
    }
    return x;
  }

  esconderTooltip(): void { 
    this.tooltip.visivel = false; 
  }

  // Getters para template (mantém compatibilidade)
  get tooltipVisivel(): boolean { return this.tooltip.visivel; }
  get tooltipX(): number { return this.tooltip.x; }
  get tooltipY(): number { return this.tooltip.y; }
  get tooltipValor(): number | string { return this.tooltip.valor; }
  get tooltipUnidade(): string { return this.tooltip.unidade; }
  get tooltipSensor(): string { return this.tooltip.sensor; }
  get tooltipHora(): string { return this.tooltip.hora; }
  get tooltipStatus(): string { return this.tooltip.status; }
  get tooltipCor(): string { return this.tooltip.cor; }

  // ==================== CONTROLES DE UI ====================

  onDataChange(e: any): void { 
    this.dataSelecionada = e.detail.value;
    this.dataSelecionadaSubject.next(this.dataSelecionada);
    this.exibirCalendario = false; 
  }
  
  limparFiltro(): void { 
    this.dataSelecionada = ''; 
    this.dataSelecionadaSubject.next('');
    this.mostrarTodos = false;
  }
  
  toggleCalendario(): void { 
    this.exibirCalendario = !this.exibirCalendario; 
  }
  
  toggleMostrarMais(): void { 
    this.mostrarTodos = !this.mostrarTodos; 
    this.atualizarListaVisivel();
  }
  
  formatarData(iso: string): string { 
    const d = new Date(iso); 
    return this.formatarDataParaComparacao(iso);
  }
  
  formatarDataHora(ts: string): string { 
    return ts || 'Data indisponível'; 
  }

  // ==================== EXPORTAÇÃO ====================

  exportarDados(): void {
    const dados = this.dadosFiltrados.map(d => ({
      Sensor: d.nome,
      Nivel: d.nivel,
      pH: d.ph,
      Turbidez: d.turbidez,
      Timestamp: d.timestamp
    }));
    
    const csv = this.converterParaCSV(dados);
    this.downloadCSV(csv, `sensores_${new Date().toISOString().split('T')[0]}.csv`);
  }

  private converterParaCSV(dados: any[]): string {
    if (!dados.length) return '';
    
    const headers = Object.keys(dados[0]).join(',');
    const rows = dados.map(obj => 
      Object.values(obj).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}