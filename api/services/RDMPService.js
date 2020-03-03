"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Rx_1 = require("rxjs/Rx");
const services = require("../core/CoreService.js");
const moment_es6_1 = require("moment-es6");
const numeral = require("numeral");
var Services;
(function (Services) {
    class RDMPS extends services.Services.Core.Service {
        constructor() {
            super(...arguments);
            this._exportedMethods = [
                'assignPermissions',
                'processRecordCounters'
            ];
        }
        processRecordCounters(oid, record, options, user) {
            const brandId = record.metaMetadata.brandId;
            const obs = [];
            _.each(options.counters, (counter) => {
                if (counter.strategy == "global") {
                    obs.push(this.getObservable(Counter.findOrCreate({ name: counter.field_name, branding: brandId }, { name: counter.field_name, branding: brandId, value: 0 })));
                }
                else if (counter.strategy == "field") {
                    let srcVal = record.metadata[counter.field_name];
                    if (!_.isEmpty(counter.source_field)) {
                        srcVal = record.metadata[counter.source_field];
                    }
                    let newVal = _.isUndefined(srcVal) || _.isEmpty(srcVal) ? 1 : _.toNumber(srcVal) + 1;
                    this.incrementCounter(record, counter, newVal);
                }
            });
            if (_.isEmpty(obs)) {
                return Rx_1.Observable.of(record);
            }
            else {
                return Rx_1.Observable.zip(...obs)
                    .flatMap(counterVals => {
                    const updateObs = [];
                    _.each(counterVals, (counterVal, idx) => {
                        let counter = options.counters[idx];
                        let newVal = counterVal[0].value + 1;
                        this.incrementCounter(record, counter, newVal);
                        updateObs.push(this.getObservable(Counter.updateOne({ id: counterVal[0].id }, { value: newVal })));
                    });
                    return Rx_1.Observable.zip(...updateObs);
                })
                    .flatMap(updateVals => {
                    return Rx_1.Observable.of(record);
                });
            }
        }
        incrementCounter(record, counter, newVal) {
            if (!_.isEmpty(counter.template)) {
                const imports = _.extend({ moment: moment_es6_1.default, numeral: numeral, newVal: newVal }, counter);
                const templateData = { imports: imports };
                const template = _.template(counter.template, templateData);
                newVal = template();
            }
            const recVal = `${TranslationService.t(counter.prefix)}${newVal}`;
            _.set(record.metadata, counter.field_name, recVal);
            if (!_.isEmpty(counter.add_value_to_array)) {
                const arrayVal = _.get(record, counter.add_value_to_array, []);
                arrayVal.push(recVal);
                _.set(record, counter.add_value_to_array, arrayVal);
            }
        }
        addEmailToList(contributor, emailProperty, emailList) {
            let editContributorEmailAddress = _.get(contributor, emailProperty, null);
            if (!editContributorEmailAddress) {
                if (!contributor) {
                    return;
                }
                editContributorEmailAddress = contributor;
            }
            if (editContributorEmailAddress != null && !_.isEmpty(editContributorEmailAddress) && !_.isUndefined(editContributorEmailAddress) && _.isString(editContributorEmailAddress)) {
                sails.log.verbose(`Pushing contrib email address ${editContributorEmailAddress}`);
                emailList.push(editContributorEmailAddress);
            }
        }
        populateContribList(contribProperties, record, emailProperty, emailList) {
            _.each(contribProperties, editContributorProperty => {
                let editContributor = _.get(record, editContributorProperty, null);
                if (editContributor) {
                    sails.log.verbose(`Contributor:`);
                    sails.log.verbose(JSON.stringify(editContributor));
                    if (_.isArray(editContributor)) {
                        _.each(editContributor, contributor => {
                            this.addEmailToList(contributor, emailProperty, emailList);
                        });
                    }
                    else {
                        this.addEmailToList(editContributor, emailProperty, emailList);
                    }
                }
            });
            return _.uniq(emailList);
        }
        filterPending(users, userEmails, userList) {
            _.each(users, user => {
                if (user != null) {
                    _.remove(userEmails, email => {
                        return email == user['email'];
                    });
                    userList.push(user['username']);
                }
            });
        }
        assignPermissions(oid, record, options) {
            sails.log.verbose(`Assign Permissions executing on oid: ${oid}, using options:`);
            sails.log.verbose(JSON.stringify(options));
            sails.log.verbose(`With record: `);
            sails.log.verbose(record);
            const emailProperty = _.get(options, "emailProperty", "email");
            const editContributorProperties = _.get(options, "editContributorProperties", []);
            const viewContributorProperties = _.get(options, "viewContributorProperties", []);
            const recordCreatorPermissions = _.get(options, "recordCreatorPermissions");
            let authorization = _.get(record, "authorization", {});
            let editContributorObs = [];
            let viewContributorObs = [];
            let editContributorEmails = [];
            let viewContributorEmails = [];
            editContributorEmails = this.populateContribList(editContributorProperties, record, emailProperty, editContributorEmails);
            viewContributorEmails = this.populateContribList(viewContributorProperties, record, emailProperty, viewContributorEmails);
            if (_.isEmpty(editContributorEmails)) {
                sails.log.error(`No editors for record: ${oid}`);
            }
            if (_.isEmpty(viewContributorEmails)) {
                sails.log.error(`No viewers for record: ${oid}`);
            }
            _.each(editContributorEmails, editorEmail => {
                editContributorObs.push(this.getObservable(User.findOne({ email: editorEmail.toLowerCase() })));
            });
            _.each(viewContributorEmails, viewerEmail => {
                viewContributorObs.push(this.getObservable(User.findOne({ email: viewerEmail.toLowerCase() })));
            });
            return Rx_1.Observable.zip(...editContributorObs)
                .flatMap(editContributorUsers => {
                let newEditList = [];
                this.filterPending(editContributorUsers, editContributorEmails, newEditList);
                if (recordCreatorPermissions == "edit" || recordCreatorPermissions == "view&edit") {
                    newEditList.push(record.metaMetadata.createdBy);
                }
                record.authorization.edit = newEditList;
                record.authorization.editPending = editContributorEmails;
                return Rx_1.Observable.zip(...viewContributorObs);
            })
                .flatMap(viewContributorUsers => {
                let newviewList = [];
                this.filterPending(viewContributorUsers, editContributorEmails, newviewList);
                if (recordCreatorPermissions == "view" || recordCreatorPermissions == "view&edit") {
                    newviewList.push(record.metaMetadata.createdBy);
                }
                record.authorization.view = newviewList;
                record.authorization.viewPending = viewContributorEmails;
                return Rx_1.Observable.of(record);
            });
        }
    }
    Services.RDMPS = RDMPS;
})(Services = exports.Services || (exports.Services = {}));
module.exports = new Services.RDMPS().exports();
