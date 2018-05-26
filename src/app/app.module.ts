import { BrowserModule } from '@angular/platform-browser';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { AppComponent } from './app.component';

import { ProductHeaderModule } from 'phmf1/app/app.module';
import { ProductViewModule } from 'pvmf2/app/app.module';
import {ProductCartModule} from 'pcmf3/app/app.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule,ProductHeaderModule,ProductViewModule,ProductCartModule],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
})
export class AppModule {}