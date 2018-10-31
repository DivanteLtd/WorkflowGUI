/**
 * Workflow GUI Pimcore Plugin
 *
 * LICENSE
 *
 * This source file is subject to the GNU General Public License version 3 (GPLv3)
 * For the full copyright and license information, please view the LICENSE.md and gpl-3.0.txt
 * files that are distributed with this source code.
 *
 * @copyright  Copyright (c) 2015-2017 Dominik Pfaffenbauer (https://www.pfaffenbauer.at)
 * @license    https://github.com/dpfaffenbauer/pimcore-WorkflowGui/blob/master/LICENSE.md     GNU General Public License version 3 (GPLv3)
 */

pimcore.registerNS("pimcore.plugin.workflowgui.item");
pimcore.plugin.workflowgui.item = Class.create({

    initialize: function (id, parentPanel) {
        this.parentPanel = parentPanel;
        this.id = id;

        Ext.Ajax.request({
            url: "/admin/workflow/get",
            success: this.loadComplete.bind(this),
            params: {
                id: this.id
            }
        });
    },

    loadComplete: function (transport) {
        var me = this,
            response = Ext.decode(transport.responseText);

        if(response && response.success) {
            me.data = response.workflow;

            var modelName = 'PimcoreWorkflow';
            if(!Ext.ClassManager.isCreated(modelName) ) {
                Ext.define(modelName, {
                    extend: 'Ext.data.Model',
                    idProperty: 'name'
                });
            }
            me.statusStore = new Ext.data.JsonStore({
                data : me.data.statuses,
                model : modelName,
                listeners: {
                    add: function(store, records, index, eOpts) {
                        Ext.each(records, function(record) {
                            me.allowedStatusStoreForTransitionDefinitons.add(record.data);
                        });
                    }
                }
            });
            this.allowedStatusStoreForTransitionDefinitons = this.deepCloneStore(this.statusStore);

            me.actionsStore = new Ext.data.JsonStore({
                data : me.data.actions,
                model : modelName
            });

            me.addLayout();
        }
    },

    addLayout: function () {
        this.panel = new Ext.TabPanel({
            activeTab: 0,
            deferredRender: false,
            forceLayout: true,
            border: false,
            closable: true,
            autoScroll: true,
            title: this.data.name,
            iconCls : 'pimcore_icon_workflow',
            items: [
                this.getSettingsPanel(),
                this.getStatusPanel(),
                this.getTransitionsPanel()
            ],
            buttons: [
                {
                    text: t("save"),
                    iconCls: "pimcore_icon_apply",
                    handler: this.save.bind(this)
                }
            ]
        });

        this.panel.on("destroy", function() {
            delete this.parentPanel.panels["workflow_" + this.id];
        }.bind(this));

        this.parentPanel.getEditPanel().add(this.panel);
        this.parentPanel.getEditPanel().setActiveTab(this.panel);

        pimcore.layout.refresh();
    },
    getSettingsPanel : function() {
        if(!this.settingsPanel) {

            var typesStore = [['object', 'object'], ['asset', 'asset'], ['document', 'document']];

            var classesStore = new Ext.data.JsonStore({
                autoDestroy: true,
                proxy: {
                    type: 'ajax',
                    url: '/admin/class/get-tree'
                },
                fields: ['text']
            });
            classesStore.load();
            var assetTypeStore = new Ext.data.JsonStore({
                autoDestroy: true,
                proxy: {
                    type: 'ajax',
                    url: '/admin/class/get-asset-types'
                },
                fields: ["text"]
            });
            assetTypeStore.load();

            var documentTypeStore = new Ext.data.JsonStore({
                autoDestroy: true,
                proxy: {
                    type: 'ajax',
                    url: '/admin/class/get-document-types'
                },
                fields: ["text"]
            });
            documentTypeStore.load();

            this.settingsPanel = new Ext.form.Panel({
                border: false,
                autoScroll: true,
                title: t('settings'),
                iconCls : 'pimcore_icon_settings',
                padding : 10,
                items: [
                    {
                        xtype : 'textfield',
                        name : 'name',
                        width: 500,
                        value : this.data.name,
                        fieldLabel : t('name')
                    },
                    {
                        xtype : 'textfield',
                        name : 'label',
                        width: 500,
                        value : this.data.label,
                        fieldLabel : t('label')
                    },
                    {
                        xtype : 'numberfield',
                        dataIndex : 'priority',
                        text : t('priority'),
                        width : 500,
                        fieldLabel : t('priority')
                    },
                    {
                        xtype : 'checkbox',
                        name : 'enabled',
                        width: 500,
                        value : this.data.enabled,
                        fieldLabel : t('enabled')
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('default_status'),
                        name: 'defaultStatus',
                        value: this.data.defaultStatus,
                        width: 500,
                        store: this.statusStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        displayField: 'label',
                        valueField: 'name'
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('types'),
                        name: 'types',
                        value: this.data.workflowSubject ? this.data.workflowSubject.types : [],
                        width: 500,
                        store: typesStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        multiSelect : true,
                        listeners: {
                            change: this.onTypeChange.bind(this)
                        }
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('allowed_classes'),
                        name: 'classes',
                        value: this.data.workflowSubject ? this.data.workflowSubject.classes.map(
                            function (x) {
                                return x.id;
                            }) : [],
                        width: 500,
                        store: classesStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        multiSelect : true,
                        displayField : 'text',
                        valueField : 'id',
                        listeners: {
                            change: this.onClassChange.bind(this)
                        }
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('allowed_asset_types'),
                        name: 'assetTypes',
                        value: this.data.workflowSubject ? this.data.workflowSubject.assetTypes : [],
                        width: 500,
                        store: assetTypeStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        multiSelect : true
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('allowed_document_types'),
                        name: 'documentTypes',
                        value: this.data.workflowSubject ? this.data.workflowSubject.documentTypes : [],
                        width: 500,
                        store: documentTypeStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        multiSelect : true
                    }
                ]
            });
        }

        return this.settingsPanel;
    },

    getStatusPanel : function() {
        if(!this.statusPanel) {
            var cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
                clicksToEdit: 1
            });

            this.statusPanel = new Ext.Panel({
                border: false,
                autoScroll: true,
                title: t('statuses'),
                iconCls : 'pimcore_icon_workflow',
                items: [
                    {
                        xtype : 'grid',
                        margin: '0 0 15 0',
                        store :  this.statusStore,
                        plugins: [
                            cellEditing
                        ],
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'name',
                                text : t('name'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                flex : 1,
                                dataIndex : 'label',
                                text : t('label'),
                                field: {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'color',
                                text : t('color'),
                                width : 100,
                                field: {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'colorInverted',
                                text : t('color inverted'),
                                width : 100,
                                field: {
                                    xtype: 'checkbox'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'objectLayout',
                                text : t('custom_layout'),
                                width : 100,
                                field: {
                                    xtype: 'numberfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'elementPublished',
                                text : t('element_published'),
                                width : 100,
                                field: {
                                    xtype: 'checkbox'
                                }
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_delete',
                                    tooltip: t('delete'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        grid.store.removeAt(rowIndex);
                                    }.bind(this)
                                }]
                            }
                        ],
                        tbar: [
                            {
                                text:t('add'),
                                handler: function(btn) {
                                    Ext.MessageBox.prompt(t('add_workflow_status'), t('enter_the_name_of_the_new_workflow_status'),
                                        function(button, value) {
                                            if (button == "ok") {
                                                var u = {
                                                    name: value,
                                                    label: value
                                                };

                                                btn.up("grid").store.add(u);
                                            }
                                        }.bind(this)
                                    );
                                },
                                iconCls:"pimcore_icon_add"
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    }
                ]
            });
        }

        return this.statusPanel;
    },


    getTransitionsPanel : function() {
        if(!this.actionsPanel) {
            var transitionDefinitions = {};
            var transitionDefinitionsRaw = this.data.transitionDefinitions;
            var globalTransition = [];

            for(var status in transitionDefinitionsRaw) {
                if(status === "globalActions") {
                    globalTransition = Object.keys(transitionDefinitionsRaw[status]);
                    continue;
                }

                var validActions = transitionDefinitionsRaw[status];

                transitionDefinitions[status] = {
                    status: status,
                    actions: []
                };

                for (var action in validActions['validActions']) {
                    if (validActions['validActions'].hasOwnProperty(action)) {
                        transitionDefinitions[status].actions.push(action);
                    }
                }
            }

            this.actionsPanel = new Ext.Panel({
                border: false,
                autoScroll: true,
                title: t('actions'),
                iconCls : 'pimcore_icon_workflow',
                items: [
                    {
                        xtype: 'combo',
                        padding : 10,
                        fieldLabel : t('global_actions'),
                        name: 'globalActions',
                        width: 500,
                        store: this.actionsStore,
                        value : globalTransition,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        multiSelect : true,
                        displayField: 'label',
                        valueField: 'name'
                    },
                    {
                        xtype : 'grid',
                        margin: '0 0 15 0',
                        store :  this.actionsStore,
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'name',
                                text : t('name'),
                                flex : 1
                            },
                            {
                                xtype : 'gridcolumn',
                                flex : 1,
                                dataIndex : 'label',
                                text : t('label')
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_edit',
                                    tooltip: t('edit'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        this.editAction(grid.store.getAt(rowIndex));
                                    }.bind(this)
                                }]
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items:[{
                                    iconCls: 'pimcore_icon_operator_booleanformatter',
                                    tooltip: t('workflow_validation_rules'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        var record = grid.store.getAt(rowIndex);
                                        var validation = new pimcore.plugin.workflowgui.validation(this, record);
                                        validation.show();
                                    }.bind(this)
                                }]
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_delete',
                                    tooltip: t('delete'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        grid.store.removeAt(rowIndex);
                                    }.bind(this)
                                }]
                            }
                        ],
                        tbar: [
                            {
                                text:t('add'),
                                handler: function(btn) {
                                    Ext.MessageBox.prompt(t('add_workflow_action'), t('enter_the_name_of_the_new_workflow_action'),
                                        function(button, value) {
                                            if (button == "ok") {
                                                var validation = [];

                                                var settings = this.getSettingsPanel().getForm().getFieldValues();
                                                console.log(settings);
                                                if (settings.types.includes('object')) {
                                                    for (var i = 0; i < settings.classes.length; i++) {
                                                        validation.push({
                                                            classId: settings.classes[i],
                                                            rules: []
                                                        });
                                                    }
                                                }

                                                var u = {
                                                    name: value,
                                                    label: value,
                                                    transitionTo : {},
                                                    notes : {
                                                        required: false
                                                    },
                                                    options: {
                                                        label: value,
                                                        notes: {
                                                            commentRequired: false,
                                                            commentEnabled: false,
                                                            additionalFields: []
                                                        }
                                                    },
                                                    validation: validation
                                                };

                                                btn.up("grid").store.add(u);
                                            }
                                        }.bind(this)
                                    );
                                }.bind(this),
                                iconCls:"pimcore_icon_add"
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    }
                ]
            });
        }

        return this.actionsPanel;
    },

    editAction : function(record, cb) {
        var transitionsTo = [];
        var transitionsFrom = [];
        var transitionFrom = Ext.isArray(record.get("transitionFrom")) ? record.get("transitionFrom") : [];
        var transitionTo = Ext.isArray(record.get("transitionTo")) ? record.get("transitionTo") : [];
        transitionTo.forEach(x => {transitionsTo.push({status: x})})
        transitionFrom.forEach(x => {transitionsFrom.push({status: x})})

        var modelName = 'PimcoreWorkflowTranstionTo';
        if(!Ext.ClassManager.isCreated(modelName) ) {
            Ext.define(modelName, {
                extend: 'Ext.data.Model',
            });
        }

        var transitionsFromStore = new Ext.data.JsonStore({
            data : transitionsFrom,
            model : modelName
        });
        var transitionsToStore = new Ext.data.JsonStore({
            data : transitionsTo,
            model : modelName
        });
        var cellEditingTransitionsFrom = Ext.create('Ext.grid.plugin.CellEditing', {
            clicksToEdit: 1,
            listeners : {
                edit : function() {
                }
            }
        });

        var cellEditingTransitionsTo = Ext.create('Ext.grid.plugin.CellEditing', {
            clicksToEdit: 1,
            listeners : {
                edit : function() {
                }
            }
        });

        var cellEditingAdditionalFields = Ext.create('Ext.grid.plugin.CellEditing', {
            clicksToEdit: 1
        });

        var additionalFieldsStore = new Ext.data.JsonStore({
            data : record.get("options").notes.additionalFields
        });

        function updateStateStore() {

        };

        var usersStore = Ext.create('Ext.data.JsonStore', {
            proxy: {
                type: 'ajax',
                url: '/admin/workflow/users'
            }
        });
        usersStore.load();

        var events = Object.assign(Ext.isObject(record.get("events")) ? record.get("events") : {});
        Ext.applyIf(events, {
            'before' : [], 'success' : [], 'failure' : []
        });

        for(var eventKey in events) {
            if(events[eventKey][0] !== eventKey) {
                events[eventKey].splice(0, 0, eventKey);
            }
        }

        var eventsStore = new Ext.data.ArrayStore({
            data : $.map(events, function(value, index) {
                return [value];
            }),
            fields : [
                'key',
                'class',
                'method'
            ]
        });
        var additionalFieldsTypesStore = [
            ['input', 'input'],
            ['textarea','textarea'],
            ['select','select'],
            ['datetime','datetime'],
            ['date','date'],
            ['user','user']
        ];
        var window = new Ext.window.Window({
            width : 800,
            height : 700,
            modal : true,
            resizeable : false,
            layout : 'fit',
            title : t('action'),
            items : [
                {
                xtype : 'form',
                bodyStyle:'padding:20px 5px 20px 5px;',
                border: false,
                autoScroll: true,
                forceLayout: true,
                fieldDefaults: {
                    labelWidth: 150
                },
                buttons: [
                    {
                        text: t('save'),
                        handler: function (btn) {
                            var window = this.up("window");
                            var grid = window.down("grid");

                            var name = window.down('[name="name"]').getValue();
                            var label = window.down('[name="label"]').getValue();
                            var notesEnabled  = window.down('[name="notesEnabled"]').getValue();
                            var notesRequired = window.down('[name="notesRequired"]').getValue();
                            var notesType = window.down('[name="notesType"]').getValue();
                            var notesTitle = window.down('[name="notesTitle"]').getValue();
                            var users = window.down('[name="users"]').getValue();
                            var notificationUsers = window.down('[name="notificationUsers"]').getValue();
                            var eventsRaw = eventsStore.getRange();
                            var eventsData = {};

                            eventsRaw.map(function(record) {
                                if(record.get("class") && record.get("method")) {
                                    eventsData[record.get("key")] = [record.get("class"), record.get("method")]
                                }
                            });

                            var transitionsFromRecords = transitionsFromStore.getRange();
                            var transitionsToRecords = transitionsToStore.getRange();
                            var additionFieldsRecords = additionalFieldsStore.getRange();
                            var additionalFields = additionFieldsRecords.map(function(record) {
                                var data = record.data;
                                data['fieldTypeSettings'] = {};
                                return data;
                            });

                            var transitionsFrom = [];
                            var transitionsTo = [];

                            transitionsFromRecords.map(function(record) {
                                transitionsFrom.push(record.get("status"));
                            });

                            transitionsToRecords.map(function(record) {
                                transitionsTo.push(record.get("status"));
                            });

                            record.set("transitionFrom", transitionsFrom);
                            record.set("transitionTo", transitionsTo);
                            record.set("name", name);
                            var options = {};
                            options['label'] = label;
                            options['notes'] = {
                                commentRequired: notesRequired,
                                commentEnabled  : notesEnabled,
                                title : notesTitle,
                                type : notesType,
                                title: notesTitle,
                                additionalFields: additionalFields
                            }
                            record.set('options', options);

                            record.set("users", users);
                            record.set("notificationUsers", notificationUsers);
                            record.set("events", eventsData);
                            if(Ext.isFunction(cb)) {
                                cb.call(record)
                            }
                            window.close();
                        },
                        iconCls: 'pimcore_icon_apply'
                    }
                ],
                items : [
                    {
                        xtype : 'textfield',
                        name : 'name',
                        anchor : '100%',
                        value : record.get("name"),
                        fieldLabel : t('name')
                    },
                    {
                        xtype : 'textfield',
                        name : 'label',
                        anchor : '100%',
                        value : record.get("options").label,
                        fieldLabel : t('label')
                    },
                    {
                        xtype : 'checkbox',
                        name : 'notesEnabled',
                        anchor : '100%',
                        checked : record.get("options").notes.commentEnabled,
                        fieldLabel : t('notes_enabled')
                    },
                    {
                        xtype : 'checkbox',
                        name : 'notesRequired',
                        anchor : '100%',
                        checked : record.get("options").notes.commentRequired,
                        fieldLabel : t('notes_required')
                    },
                    {
                        xtype : 'textfield',
                        name : 'notesType',
                        anchor : '100%',
                        value : record.get("options").notes.hasOwnProperty("type") ? record.get("options").notes.type : '',
                        fieldLabel : t('notes_type')
                    },
                    {
                        xtype : 'textfield',
                        name : 'notesTitle',
                        anchor : '100%',
                        value : record.get("options").notes.hasOwnProperty("title") ? record.get("options").notes.title : '',
                        fieldLabel : t('notes_title')
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('users'),
                        name: 'users',
                        value: record.get("users") ? record.get("users") : [],
                        width: 500,
                        store: usersStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        displayField: 'text',
                        valueField: 'id',
                        multiSelect : true
                    },
                    {
                        xtype: 'combo',
                        fieldLabel: t('notification_users'),
                        name: 'notificationUsers',
                        value: record.get("notificationUsers") ? record.get("notificationUsers") : [],
                        width: 500,
                        store: usersStore,
                        triggerAction: 'all',
                        typeAhead: false,
                        editable: false,
                        forceSelection: true,
                        queryMode: 'local',
                        displayField: 'text',
                        valueField: 'id',
                        multiSelect : true
                    },
                    {
                        xtype : 'grid',
                        title : t('events'),
                        margin: '0 0 15 0',
                        store :  eventsStore,
                        plugins: [
                            Ext.create('Ext.grid.plugin.CellEditing', {
                                clicksToEdit: 1
                            })
                        ],
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'key',
                                text : t('key'),
                                flex : 1
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'class',
                                text : t('class'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                flex : 1,
                                dataIndex : 'method',
                                text : t('method'),
                                field : {
                                    xtype: 'textfield'
                                }
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    },
                    {
                        xtype : 'grid',
                        title : t('transition_from'),
                        margin: '0 0 15 0',
                        store :  transitionsFromStore,
                        plugins: [
                            cellEditingTransitionsFrom
                        ],
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                flex : 1,
                                dataIndex : 'status',
                                text : t('status'),
                                renderer : function(value) {
                                    if(Ext.isArray(value)) {
                                        var textValues = [];

                                        Ext.each(value, function(v) {
                                            var record = this.statusStore.getById(v);

                                            if(record) {
                                                textValues.push(record.get("label"));
                                            }
                                        }.bind(this));

                                        return textValues.join(", ");
                                    }
                                    var record = this.statusStore.getById(value);

                                    if(record) {
                                        return record.get("label");
                                    }

                                    return "";
                                }.bind(this),
                                field: {
                                    xtype: 'combo',
                                    name: 'types',
                                    width: 500,
                                    store: this.statusStore,
                                    triggerAction: 'all',
                                    typeAhead: false,
                                    editable: false,
                                    forceSelection: true,
                                    queryMode: 'local',
                                    multiSelect : false,
                                    displayField: 'label',
                                    valueField: 'name'
                                }
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_delete',
                                    tooltip: t('delete'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        grid.store.removeAt(rowIndex);
                                    }.bind(this)
                                }]
                            }
                        ],
                        tbar: [
                            {
                                text:t('add'),
                                handler: function(btn) {
                                    var u = {
                                        status: ''
                                    };

                                    btn.up("grid").store.add(u);
                                },
                                iconCls:"pimcore_icon_add"
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    },
                    {
                        xtype : 'grid',
                        title : t('transition_to'),
                        margin: '0 0 15 0',
                        store :  transitionsToStore,
                        plugins: [
                            cellEditingTransitionsTo
                        ],
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                flex : 1,
                                dataIndex : 'status',
                                text : t('status'),
                                renderer : function(value) {
                                    if(Ext.isArray(value)) {
                                        var textValues = [];

                                        Ext.each(value, function(v) {
                                            var record = this.statusStore.getById(v);

                                            if(record) {
                                                textValues.push(record.get("label"));
                                            }
                                        }.bind(this));

                                        return textValues.join(", ");
                                    }
                                    var record = this.statusStore.getById(value);

                                    if(record) {
                                        return record.get("label");
                                    }

                                    return "";
                                }.bind(this),
                                field: {
                                    xtype: 'combo',
                                    name: 'types',
                                    width: 500,
                                    store: this.statusStore,
                                    triggerAction: 'all',
                                    typeAhead: false,
                                    editable: false,
                                    forceSelection: true,
                                    queryMode: 'local',
                                    multiSelect : false,
                                    displayField: 'label',
                                    valueField: 'name'
                                }
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_delete',
                                    tooltip: t('delete'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        grid.store.removeAt(rowIndex);
                                    }.bind(this)
                                }]
                            }
                        ],
                        tbar: [
                            {
                                text:t('add'),
                                handler: function(btn) {
                                        var u = {
                                            status: ''
                                        };

                                        btn.up("grid").store.add(u);
                                },
                                iconCls:"pimcore_icon_add"
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    },
                    {
                        xtype : 'grid',
                        title : t('additional_fields'),
                        margin: '0 0 15 0',
                        store :  additionalFieldsStore,
                        plugins: [
                            cellEditingAdditionalFields
                        ],
                        sm: Ext.create('Ext.selection.RowModel', {}),
                        columns : [
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'name',
                                text : t('name'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'fieldType',
                                text : t('field_type'),
                                flex : 1,
                                field : {
                                    xtype: 'combo',
                                    store: additionalFieldsTypesStore,
                                    multiSelect : false
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'title',
                                text : t('title'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'blankText',
                                text : t('blank_text'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'required',
                                text : t('mandatoryfield'),
                                flex : 1,
                                field : {
                                    xtype: 'checkbox'
                                }
                            },
                            {
                                xtype : 'gridcolumn',
                                dataIndex : 'setterFn',
                                text : t('setter_function'),
                                flex : 1,
                                field : {
                                    xtype: 'textfield'
                                }
                            },
                            {
                                menuDisabled: true,
                                sortable: false,
                                xtype: 'actioncolumn',
                                width: 50,
                                items: [{
                                    iconCls: 'pimcore_icon_delete',
                                    tooltip: t('delete'),
                                    handler: function (grid, rowIndex, colIndex) {
                                        grid.store.removeAt(rowIndex);
                                    }.bind(this)
                                }]
                            }
                        ],
                        tbar: [
                            {
                                text:t('add'),
                                handler: function(btn) {
                                    var u = {
                                        name: '',
                                        fieldType: '',
                                        title : '',
                                        blankText : '',
                                        required : false,
                                        setterFn : ''
                                    };

                                    btn.up("grid").store.add(u);
                                },
                                iconCls:"pimcore_icon_add"
                            }
                        ],
                        viewConfig:{
                            forceFit:true
                        }
                    }
                ]
            }]
        });

        window.show();
    },


    updateStatusStoreForTransitionDefinitions : function () {
        this.allowedStatusStoreForTransitionDefinitons.filterBy(function (r) {
            var id = r.data.name;

            if (!this.transitionDefinitionStore.getById(id)) {
                return true;
            }

            return false;
        }.bind(this));
    },

    save: function () {
        Ext.Ajax.request({
            url: "/admin/workflow/update",
            method: "post",
            params: {
                data: this.getData(),
                id : this.id
            },
            success: this.saveOnComplete.bind(this)
        });
    },

    getData: function () {
        var settings = this.settingsPanel.getForm().getFieldValues();
        const classesStore = this.settingsPanel.getForm().findField('classes').getStore();
        var selectedClasses = this.settingsPanel.getForm().findField('classes').getValue();
        var selectedClassesNamesArray = [];
        selectedClasses.forEach(x => {
            selectedClassesNamesArray.push({text: classesStore.getById(x).data.text, id: x });
        })
        settings.classes = selectedClassesNamesArray;
        var statuses = this.statusStore.getRange().map(function(record) {return record.data;});
        var actions = this.actionsStore.getRange().map(function(record) {return record.data;});
        var transitionsDefinitionsData = {
            globalActions : {}
        };

        Ext.each(this.actionsPanel.down('[name="globalActions"]').getValue(), function(val) {
            transitionsDefinitionsData.globalActions[val] = null;
        });

        return Ext.JSON.encode({
            settings: settings,
            statuses : statuses,
            actions : actions,
            transitionDefinitions : transitionsDefinitionsData
        });
    },

    saveOnComplete: function () {
        this.parentPanel.tree.getStore().load({
            node: this.parentPanel.tree.getRootNode()
        });
        pimcore.helpers.showNotification(t("success"), t("workflow_saved_successfully"), "success");
    },

    activate: function () {
        this.parentPanel.getEditPanel().setActiveTab(this.panel);
    },

    deepCloneStore : function  (source) {
        source = Ext.isString(source) ? Ext.data.StoreManager.lookup(source) : source;
        var target = Ext.create(source.$className, {
            model: source.model
        });

        target.add(Ext.Array.map(source.getRange(), function (record) {
            return record.copy();
        }));

        return target;
    },

    onTypeChange: function (field, newValue, oldValue, eOpts) {
        if (!newValue.includes('object')) {
            this.actionsStore.getRange().forEach(function (record) {
                record.set('validation', []);
            });
        } else if (!oldValue.includes('object')) {
            var validation = [];

            var settings = this.getSettingsPanel().getForm().getFieldValues();
            for (var i = 0; i < settings.classes.length; i++) {
                validation.push({
                    classId: settings.classes[i],
                    rules: []
                });
            }

            this.actionsStore.getRange().forEach(function (record) {
                record.set('validation', validation);
            });
        }
    },

    onClassChange: function (field, newValue, oldValue, eOpts) {
        this.actionsStore.getRange().forEach(function (record) {
            var validation = record.get('validation') || [];

            validation = validation.filter(function (item) {
                return newValue.includes(item.classId);
            });

            for (var i = 0; i < newValue.length; i++) {
                var classId = newValue[i];

                var exists = validation.some(function (item) {
                    return classId == item.classId;
                });

                if (!exists) {
                    validation.push({
                        classId: classId,
                        rules: []
                    });
                }
            }

            record.set('validation', validation);
        });
    }
});
