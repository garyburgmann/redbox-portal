// Copyright (c) 2017 Queensland Cyber Infrastructure Foundation (http://www.qcif.edu.au/)
//
// GNU GENERAL PUBLIC LICENSE
//    Version 2, June 1991
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, write to the Free Software Foundation, Inc.,
// 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

import { Component, Inject, Input, ElementRef } from '@angular/core';
import { Location, LocationStrategy, PathLocationStrategy } from '@angular/common';
import { Role, User, LoginResult, SaveResult } from '../shared/user-models';
import * as _ from "lodash-lib";
import { LoadableComponent } from '../shared/loadable.component';
import { TranslationService } from '../shared/translation-service';
import { RecordsService } from '../shared/form/records.service';
import { DashboardService } from '../shared/dashboard-service';

declare var pageData :any;
declare var jQuery: any;
/**
 * Record Search component
 *
 *
 * @author <a target='_' href='https://github.com/shilob'>Shilo Banihit</a>
 */
@Component({
  moduleId: module.id,
  selector: 'record-search',
  templateUrl: './record_search.html',
  providers: [Location, {provide: LocationStrategy, useClass: PathLocationStrategy}]
})
export class RecordSearchComponent extends LoadableComponent {
  @Input() record_type: string;
  @Input() search_str: string;
  @Input() search_url: string;

  plans: any[];
  advanceMode: boolean;
  advancedSearchLabel: string;
  params: any;
  isSearching: boolean;
  searchMsgType: string;
  searchMsg: string;

  constructor(
   elm: ElementRef,
   @Inject(Location) protected LocationService: Location,
   protected recordsService: RecordsService,
   protected dashboardService: DashboardService,
   public translationService:TranslationService) {
    super();
    this.initTranslator(translationService);
    this.record_type = elm.nativeElement.getAttribute('record_type');
    this.search_str = elm.nativeElement.getAttribute('search_str');
    this.search_url = elm.nativeElement.getAttribute('search_url');
    this.setParams();
  }

  ngOnInit() {
    this.translationService.isReady((tService:any)=> {
      this.setLoading(false);
      if (this.search_str) {
        this.search();
      }
    });
  }

  setParams() {
    this.params = {
      basic: this.search_str
    }
  }

  resetSearch() {
    this.search_str = null;
    this.setParams();
    this.plans = null;
    this.LocationService.go(this.search_url);
    this.searchMsg = null;
  }

  syncLoc() {
    this.LocationService.go(`${this.search_url}?q=${this.params.basic}&type=${this.record_type}`);
  }

  toggleAdvancedSearch() {
    this.advanceMode = !this.advanceMode;
    this.setSearchLabel();
  }

  setSearchLabel() {
    if (this.advanceMode) {
      this.advancedSearchLabel = 'record-search-advanced-hide';
    } else {
      this.advancedSearchLabel = 'record-search-advanced-show';
    }
  }

  search() {
    this.isSearching = true;
    this.plans = null;
    this.searchMsgType = "info";
    this.searchMsg = `${this.translationService.t('record-search-searching')}${this.spinnerElem}`;
    this.syncLoc();
    this.recordsService.search(this.record_type, this.params.basic).then((res:any)=>{
      this.isSearching = false;
      this.searchMsgType = "success";
      this.searchMsg = `${this.translationService.t('record-search-results')}${res.length}`;
      this.dashboardService.setDashboardTitle(null, res);
      this.plans = res;
    }).catch((err:any)=>{
      this.isSearching = false;
      this.searchMsg = err;
      this.searchMsgType = "danger";
    });

  }
}
