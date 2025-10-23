import { Component, OnInit } from '@angular/core';
import { Api } from '../api';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone:false
})
export class DashboardPage implements OnInit {

  constructor(private apiService:Api) { }

  dados: any[] = [];
  historicoDia: any[] = []; // Nova propriedade para armazenar o histórico

  ngOnInit() {
    this.carregarDados();
    this.carregarHistoricoDia(); // Chama a nova função
  }

  // Função original
  carregarDados(): any {
    this.apiService.getSensores().subscribe({
      next: (data: any[]) => {
        console.log('Dados sensores:', data);
        this.dados = data;
      }, 
      error: (err) => {
        console.log('Erro ao carregar sensores:', err);
      }
    });
  }

  // NOVA FUNÇÃO - Carregar histórico do dia
  carregarHistoricoDia(): any {
    // Substitua 'nercelso' pelo nome da sua collection
    const collection = 'nercelso';
    
    this.apiService.getHistoricoDia(collection).subscribe({
      next: (data: any[]) => {
        console.log('Histórico do dia:', data); // PRINTA NO CONSOLE
        this.historicoDia = data;
      },
      error: (err) => {
        console.log('Erro ao carregar histórico:', err);
      }
    });
  }
}