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

dados:any [] = [];




  ngOnInit() {
    this.carregarDados()
  }

  carregarDados():any {
    this.apiService.getSensores().subscribe({
      next: (data:any[]) => {
        console.log(data)
        this.dados = data
      }, error : (err) => {
        console.log(err);
      }
    });
  }
}
