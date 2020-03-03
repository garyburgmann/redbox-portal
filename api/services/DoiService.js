"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Rx_1 = require("rxjs/Rx");
const services = require("../core/CoreService.js");
require("rxjs/add/operator/toPromise");
const request = require("request-promise");
var Services;
(function (Services) {
    class Doi extends services.Services.Core.Service {
        constructor() {
            super(...arguments);
            this._exportedMethods = [
                'publishDoi'
            ];
        }
        publishDoi(oid, record, options) {
            if (this.metTriggerCondition(oid, record, options) === "true") {
                let apiEndpoints = {
                    create: _.template('<%= baseUrl%>mint.json/?app_id=<%= apiKey%>&url=<%= url%>'),
                };
                let mappings = options.mappings;
                let xmlElements = {
                    wrapper: _.template('<resource xmlns="http://datacite.org/schema/kernel-4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4.1/metadata.xsd">\n<%= xml %></resource>'),
                    id: _.template('<identifier identifierType="DOI"><%= doi %></identifier>\n'),
                    title: _.template('<titles><title><%= title %></title></titles>\n'),
                    publisher: _.template('<publisher><%= publisher %></publisher>\n'),
                    pubYear: _.template('<publicationYear><%= pubYear %></publicationYear>\n'),
                    resourceType: _.template('<resourceType resourceTypeGeneral="<%= resourceType %>"><%= resourceText %></resourceType>\n'),
                    creator: _.template('<creator><creatorName><%= creatorName %></creatorName></creator>\n'),
                    creatorWrapper: _.template('<creators>\n<%= creators %></creators>\n')
                };
                let xmlString = "";
                xmlString += xmlElements.id({ doi: "10.0/0" });
                let creators = _.get(record, mappings.creators);
                if (creators === null || creators.length == 0) {
                }
                else {
                    let creatorString = "";
                    _.each(creators, creator => {
                        creatorString += xmlElements.creator({ creatorName: creator.text_full_name });
                    });
                    xmlString += xmlElements.creatorWrapper({ creators: creatorString });
                }
                let title = _.get(record, mappings.title);
                if (title == null || title.trim() == "") {
                }
                else {
                    xmlString += xmlElements.title({ title: title });
                }
                let publisher = _.get(record, mappings.publisher);
                if (publisher == null || publisher.trim() == "") {
                }
                else {
                    xmlString += xmlElements.publisher({ publisher: publisher });
                }
                let pubYear = _.get(record, mappings.publicationYear);
                if (pubYear == null || pubYear.trim() == "") {
                }
                else {
                    xmlString += xmlElements.pubYear({ pubYear: pubYear });
                }
                let resourceType = "Dataset";
                let resourceTypeText = _.get(record, mappings.resourceTypeText);
                if (resourceType == null || resourceType.trim() == "") {
                }
                else {
                    if (resourceTypeText == null || resourceTypeText == "null") {
                        resourceTypeText = "";
                    }
                    xmlString += xmlElements.resourceType({ resourceType: resourceType, resourceText: resourceTypeText });
                }
                let xml = xmlElements.wrapper({ xml: xmlString });
                let url = this.runTemplate(mappings.url, record);
                let createUrl = apiEndpoints.create({ baseUrl: options.baseUrl, apiKey: options.apiKey, url: url });
                let acceptedResponseCodes = ['MT001', 'MT002', 'MT003', 'MT004'];
                if (options.sharedSecretKey) {
                    let buff = new Buffer(options.sharedSecretKey);
                    let encodedKey = buff.toString('base64');
                    let postRequest = request.post({ url: createUrl, body: xml, headers: { 'Authorization': `Basic ${encodedKey}` } });
                    postRequest.then(resp => {
                        let respJson = JSON.parse(resp);
                        if (acceptedResponseCodes.indexOf(respJson.response.responsecode) != -1) {
                            let doi = respJson.response.doi;
                            record.metadata.citation_doi = doi;
                            sails.log.info(`DOI generated ${doi}`);
                            const brand = BrandingService.getBrand('default');
                            RecordsService.updateMeta(brand, oid, record).subscribe(response => { sails.log.debug(response); });
                        }
                        else {
                            sails.log.error('DOI request failed');
                            sails.log.error(resp);
                        }
                    }).catch(function (err) {
                        sails.log.error("DOI generation failed");
                        sails.log.error(err);
                    });
                }
                else {
                    request.post({ url: createUrl, body: xmlString }).then(resp => {
                        let respJson = JSON.parse(resp);
                        if (acceptedResponseCodes.indexOf(respJson.response.responsecode) != -1) {
                            let doi = respJson.response.doi;
                            record.metadata.citation_doi = doi;
                            sails.log.debug(`DOI generated ${doi}`);
                            const brand = BrandingService.getBrand('default');
                            RecordsService.updateMeta(brand, oid, record).subscribe(response => { sails.log.debug(response); });
                        }
                        else {
                            sails.log.error('DOI request failed');
                            sails.log.error(resp);
                        }
                    }).catch(function (err) {
                        sails.log.error("DOI generation failed");
                        sails.log.error(err);
                    });
                }
            }
            else {
                sails.log.info("trigger condition failed");
            }
            return Rx_1.Observable.of(null);
        }
        runTemplate(template, variables) {
            if (template && template.indexOf('<%') != -1) {
                return _.template(template)(variables);
            }
            return _.get(template, variables);
        }
    }
    Services.Doi = Doi;
})(Services = exports.Services || (exports.Services = {}));
module.exports = new Services.Doi().exports();
