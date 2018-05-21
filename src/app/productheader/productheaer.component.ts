import { Component, ViewEncapsulation, TemplateRef, ViewChild, ElementRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser'

@Component({
  selector: 'product-header',
  templateUrl: './productheader.component.html',
  styleUrls: ['./productheader.component.css'],
  encapsulation: ViewEncapsulation.Emulated
})
export class ProductHeaderComponent {
 
    public productlist : any[] = [
    {
      productname : 'JBL Flip 4',
      code : 'cat1-0001',
      price : 18.01,
      rating : '4'
    }, {
      productname : 'Bose Sound Link',
      code : 'cat1-0010',
      price : 129.05,
      rating : '5'
    }, {
      productname : 'AB Portable',
      code : 'cat1-0008',
      price : 19.78,
      rating : '3'
    }, {
      productname : 'AE-9 Portable',
      code : 'cat1-0011',
      price : 299.99,
      rating : '3'
    }, {
      productname : 'JBL Pulse 3',
      code : 'cat1-0009',
      price : 23.05,
      rating : '4'
    }
  ];
  constructor() {
    
  }
   public addToCart(product) {
    //window.frames[0].postMessage(product, '*');
  }
}