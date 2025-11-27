import { Component, OnInit } from '@angular/core';
import { Api } from '../api';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit {

  constructor(private apiService: Api) { }

  dados: any[] = [];
  dadosFiltrados: any[] = [];
  dataSelecionada: string = '';
  exibirCalendario: boolean = false;
  dataMaxima: string = new Date().toISOString();

  private atualizacaoAutomatica!: Subscription;

  ngOnInit() {
    // Define a data de hoje como padrão
    this.dataSelecionada = new Date().toISOString();

    // Carrega os dados imediatamente
    this.carregarDados();

    // Atualiza automaticamente a cada 10 segundos
    this.atualizacaoAutomatica = interval(1000).subscribe(() => {
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
      }, error: (err) => {
        console.log('Erro ao carregar dados:', err);
      }
    });
  }

  filtrarPorData(dataISO: string) {
    if (!dataISO || this.dados.length === 0) {
      this.dadosFiltrados = this.dados;
      console.log('Sem filtro aplicado. Total de dados:', this.dados.length);
      return;
    }

    const dataSelecionada = new Date(dataISO);
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataFormatada = `${dia}/${mes}/${ano}`;


    

    console.log('Filtrando por data:', dataFormatada);
    console.log('Exemplo de timestamp dos dados:', this.dados[0]?.timestamp);

    this.dadosFiltrados = this.dados.filter(item => {
      if (item.timestamp) {
        // O timestamp vem no formato "23/10/2025, 14:45:35"
        // Vamos pegar apenas a parte da data (antes da vírgula)
        const dataItemString = item.timestamp.split(',')[0].trim();
        
        console.log('Comparando:', dataItemString, '===', dataFormatada);
        return dataItemString === dataFormatada;
      }
      return false;
    });

    console.log(`Dados filtrados para ${dataFormatada}:`, this.dadosFiltrados.length);
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
    this.exibirCalendario = false;
    console.log('Filtro removido. Mostrando todos os dados:', this.dadosFiltrados.length);
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
    // O timestamp já vem formatado do backend: "23/10/2025, 14:45:35"
    return timestampBR;
  }
}