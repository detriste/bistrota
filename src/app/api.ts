import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Api {

  private apiUrl: string = "https://esp32-mongodb-idev3.onrender.com"

  constructor(private htpp:HttpClient) {}

  getSensores():Observable<any[]>{
    return this.htpp.get<any[]>(this.apiUrl+"/api/leituras/med")
  }
  

  getHistoricoDia(collection: string):Observable<any[]>{
    return this.htpp.get<any[]>(this.apiUrl+"/api/historico-dia/"+collection)
  }
  
}