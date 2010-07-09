// Authors: Joe Redmon and Ophir Lifshitz
// view_file.js

/* This is where the fun begins, now we have a Tab panel where you can see both the actual data
displayed in an GridPanel, and the chart of the data, rendered with flot */

var globalPlots = { plot: [], residplot: [] };

Ext.onReady(function () {
    loadMask = new Ext.LoadMask(Ext.getBody(), { msg: 'Please wait a moment while the page loads...' } );
    loadMask.show();
    
    Ext.state.Manager.setProvider(new Ext.state.CookieProvider());
    var conn = new Ext.data.Connection();
    var store = new Ext.data.ArrayStore();
    var fieldData = [];
    var gridColumns = [];
    var storeFields = [];
    var metadataObj = {};
    var dataArray = [];
    var iv = 'A4'
    // Initialize grid for data view
    var GridPanel = new Ext.grid.GridPanel({
        title:          'Data table',
        
        region:         'center',
        height:         588,
        autoWidth:      true,
        horizontalScroll: true,
        
        store:          store,
        columns:        gridColumns,
        stripeRows:     true,
        
        id:             'GridPanel',
    });
    
    var MetadataStore = new Ext.data.JsonStore({
        data:           [],
        fields:         ['name', 'data'],
    });
    var MetadataGridPanel = new Ext.grid.GridPanel({
        
        store:          MetadataStore,
        columns:        [ { header: 'Name', dataIndex: 'name', width: 164 }, { header: 'Data', id: 'data', dataIndex: 'data', width: 1000 }],
        stripeRows:     true,
        
//        viewConfig:     { forceFit: true },
//        autoExpandColumn: 'data',
//        horizontalScroll: true,

        title:          'Metadata',
        
        onRender:       MetadataGridTooltipRender,
        listeners: {
            render: function (g) {
                g.on("beforetooltipshow", function(grid, row, col) {
                    metadataRecord = MetadataStore.getAt(row);
                    metadataText = metadataRecord.get(metadataRecord.fields.keys[col]);
                    grid.tooltip.body.update(metadataText);
                });
            }
        },

        
        region:         'east',
        collapsible:    true,
        minWidth:       200,
        width: 250,
        maxWidth:       500,
        
        id:             'MetadataGridPanel',
    });
    

    var DataTabPanel = new Ext.Panel({
        height:         588, // why not auto!?
        
        layout:         'border',
        defaults:       { split: true },
        
        id:             'DataTabPanel',
        items:          [ GridPanel, MetadataGridPanel ],
    });

    var GridRowContextMenu = new Ext.menu.Menu({
        id:             'GridRowContextMenu',
        items:          [{
                            text:       'Highlight this point on chart',
                            icon:       'http://famfamfam.com/lab/icons/silk/icons/tag_yellow.png',
                            handler:    GridRowContextHighlight,
                        }],
    });
    
    function displayGridRowContextMenu (grid, rowIndex, event) {
        GridRowContextMenu.grid = grid;
        GridRowContextMenu.rowIndex = rowIndex;
        GridRowContextMenu.showAt(event.getXY());
        event.stopEvent();
    }
    function GridRowContextHighlight (menuItem, event) {
        record = menuItem.parentMenu.grid.getStore().getAt(menuItem.parentMenu.rowIndex);
        xData = record.get(xChoice.getValue());
        yData = record.get(yChoice.getValue());
        
        plot.highlight(plot.getData()[0], [xData, yData]);
    }
    
    Ext.ToolTip.prototype.onTargetOver = Ext.ToolTip.prototype.onTargetOver.createInterceptor(function (e) {
        this.baseTarget = e.getTarget();
    });
    Ext.ToolTip.prototype.onMouseMove = Ext.ToolTip.prototype.onMouseMove.createInterceptor(function(e) {
        if (!e.within(this.baseTarget)) {
            this.onTargetOver(e);
            return false;
        }
    });
    function MetadataGridTooltipRender () {
        Ext.grid.GridPanel.prototype.onRender.apply(this, arguments);
        this.addEvents("beforetooltipshow");
        this.tooltip = new Ext.ToolTip({
            renderTo: Ext.getBody(),
            target: this.view.mainBody,
            listeners: {
                beforeshow: function(qt) {
                    var v = this.getView();
    			          var row = v.findRowIndex(qt.baseTarget);
    			          var cell = v.findCellIndex(qt.baseTarget);
    			          this.fireEvent("beforetooltipshow", this, row, cell);
                },
                scope: this,
            }
        });
    }





// [ CHART PANEL ]

    var ChartStatusContainer = new Ext.Container({
//        autoHeight:     true,
        colspan:        3,
        
        id:             'ChartStatusContainer',
        html:           '<p></p>',
    });

    /* ComboBoxes allow user to specify X and Y cooordinates for the graph, they are populated with field data when the file is initially loaded and do not get updated if the file is changed, since it is unlikely that new parameters will be added, even in live data. */
    var xChoice = new Ext.form.ComboBox({
        fieldLabel:     'X axis',
        hiddenName:     'xchoice',
        store:          fieldData,
        typeAhead:      true,
        mode:           'local',
        triggerAction:  'all',
        emptyText:      'Select X axis...',
        selectOnFocus:  true,
        listeners:      { select: { fn: selection } },
        
        id:             'xTitle',
        listClass:      'xChoiceList', /* Apply class to dropdown menu list */
    });
    var yChoice = new Ext.form.ComboBox({
        fieldLabel:     'Y axis',
        hiddenName:     'ychoice',
        store:          fieldData,
        typeAhead:      true,
        mode:           'local',
        triggerAction:  'all',
        emptyText:      'Select Y axis...',
        selectOnFocus:  true,
        listeners:      { select: { fn: selection } },
        
        id:             'yTitle',
        listClass:      'yChoiceList', /* Apply class to dropdown menu list */
    });

    // Comboboxes have their own containers to apply unique styles (i.e., alignment relative to plot)
    var xChoiceContainer = new Ext.Container({
     // width:          500,
        id:             'xChoiceContainer',
        cls:            'ChoiceContainer',
        items:          [ xChoice ],
    });
    var yChoiceContainer = new Ext.Container({
     // height:         500,
        id:             'yChoiceContainer',
        cls:            'ChoiceContainer',
        items:          [ yChoice ],
    });
    var xyCornerContainer = new Ext.Container({
        id:             'xyCornerContainer',
        
        html:           '<p style="line-height: .8; font-size: .8em;">Mouse: (<span id="MIC-mx"></span>, <span id="MIC-my"></span>)<br/>' +
                        'Page: (<span id="MIC-px"></span>, <span id="MIC-py"></span>)<br />' +
                        '<span id="MIC-d" style="display: none;">Point: (<span id="MIC-dx"></span>, <span id="MIC-dy"></span> &plusmn; <span id="MIC-de"></span>)</p>',
    });
    

    /* Holds the flot plot */
    var PlotContainer = new Ext.Container({
        id:             'PlotContainer',
    });
    
    var ChartContainer = new Ext.Container({
     // height:         500,
        valueField:     'id',
        displayField:   'name',
        autoWidth:      true,
        
        id:             'ChartContainer',
        items:          [ PlotContainer ],
    });
    
    LegendSeriesStore = new Ext.data.JsonStore({
        data:           globalPlots.plot,
        fields:         [ 'label', 'data', 'points', 'lines', 'color' ],
        autoLoad:       true,
    });
    var LegendSeriesTemplate = new Ext.XTemplate(
        '<ul id="legendSeries">',
        '<tpl for=".">',
            '<li id="legendSeries{#}">',
                '<input type="checkbox" name="legendSeriesCheck{#}" id="legendSeriesCheck{#}" checked="checked" />',
                '<label for="legendSeriesCheck{#}"><span style="-moz-box-shadow: 0 0 0 1px {color}; -webkit-box-shadow: 0 0 0 1px {color}; background-color: {color};"></span>{label}</label>',
                '<div>',
                '<tpl if="(globalPlots.plot[xindex - 1].functionInfo)">',
                    '<p>&chi;&#178; = {[globalPlots.plot[xindex - 1].functionInfo.chisq]}</p>',
                '</tpl>',
                '</div>',
            '</li>',
        '</tpl></ul>'
    );
    var LegendContainer = new Ext.DataView({
        tpl:            LegendSeriesTemplate,
        store:          LegendSeriesStore,
        itemSelector:   'li',
    
        id:             'LegendContainer',
        autoWidth:      true,
    });
    var ChartInfoContainer = new Ext.Container({
//        title:          'Chart information',
        
//        autoHeight:     true,
        rowspan:        3,
        
        id:             'ChartInfoContainer',
        items:          [ LegendContainer ],
    });
    var yResidContainer = new Ext.Container({
        id:             'yResidualsContainer',
    });
    var ResidPlotContainer = new Ext.Container({
        id:             'ResidPlotContainer',
    });
    var ResidChartContainer = new Ext.Container({
        title:          'Residuals',
        
        id:             'ResidChartContainer',
        items:          [ ResidPlotContainer ],
    });



    var PlotContextMenu = new Ext.menu.Menu({
        id:             'PlotContextMenu',
        items:          [{
                            text:       'Zoom reset',
                            icon:       'http://famfamfam.com/lab/icons/silk/icons/zoom.png',
                            handler:    zoomPlot,
                            data:       0.0,
                        },
                        {
                            text:       'Zoom in (+25%)',
                            icon:       'http://famfamfam.com/lab/icons/silk/icons/zoom_in.png',
                            handler:    zoomPlot,
                            data:       1.25,
                        },
                        {
                            text:       'Zoom out (\u201325%)',
                            icon:       'http://famfamfam.com/lab/icons/silk/icons/zoom_out.png',
                            handler:    zoomPlot,
                            data:       0.8,
                        },
                        '-',
                        {
                            id:         'dragCheckZoom',
                            text:       'Drag and select to zoom',
                          //icon:       'http://famfamfam.com/lab/icons/silk/icons/magnifier.png',
                          //iconCls:    'icon-radio-unchecked',
                            group:      'dragCheck',
                            checked:    false,
                            checkHandler: dragCheckHandler,
                        },
                        {
                            id:         'dragCheckPan',
                            text:       'Drag to pan',
                          //icon:       'http://sexybuttons.googlecode.com/svn-history/r2/trunk/images/icons/silk/arrow_nsew.png',
                          //iconCls:    'icon-radio-checked',
                            group:      'dragCheck',
                            checked:    true,
                            checkHandler: dragCheckHandler,
                        },
                        '-',
                        {
                            id:         'scaleCheckLog',
                            text:       '<s>Logarithmic scale<\/s>',
                            group:      'scaleCheck',
                            checked:    false,
                            checkHandler: scaleCheckHandler,
                        },
                        {
                            id:         'scaleCheckLinear',
                            text:       '<s>Linear scale<\/s>',
                            group:      'scaleCheck',
                            checked:    false,
                            checkHandler: scaleCheckHandler,
                        }],
    });
    
    function displayPlotContextMenu (event) {
        PlotContextMenu.showAt(event.getXY());
        event.stopEvent();
    }


// [ TOOLS PANEL ]

     FunctionSelectStore = new Ext.data.ArrayStore({
        data:           [ [ 1, 'Linear' ], [ 2, 'Linear drag test' ],
                          [ 11, 'Gaussian' ], [ 12, 'Gaussian drag test' ],
                          [ 21, 'Lorentzian' ], [ 22, 'Lorentzian drag test' ],
                          [ -1, '...' ] ],
        fields:         [ 'id', 'name' ],
        idIndex:        0, // Important: specifies the index of the ID column; used in getById()
    });
     FunctionSelect = new Ext.form.ComboBox({
        fieldLabel:     'Function',
        emptyText:      'Select a fitting function...',
        hiddenName:     'function',
        
        allowBlank:     false,
        anchor:         '-20',
        
        store:          FunctionSelectStore,
        valueField:     'id',
        displayField:   'name',
        
        typeAhead:      true,
        mode:           'local',
        triggerAction:  'all',
        selectOnFocus:  true,
        
        id:             'FunctionSelect',
        itemCls:        'formSelect',
    });
    var CreateFunctionButton = new Ext.Button({
        text:           'Create function',
        type:           'submit',
        handler:        fitFunction,
        
        id:             'CreateFunctionButton',
        cls:            'submitButton',
    });
    var FitThisSeriesButton = new Ext.Button({
        text:           'Fit this series',
        type:           'submit',
        handler:        fitSeries,
        
        id:             'FitThisSeriesButton',
        cls:            'submitButton strongButton',
    });
    var ClearThisCurveButton = new Ext.Button({
        text:           'Clear this curve',
        type:           'reset',
        handler:        clearCurve,
        
        id:             'ClearThisCurveButton',
        cls:            'resetButton',
    });

    function fitFunction (button, event) {
        fittingFunction = FunctionSelect.getValue();
        //fittingFunction = record.data.id;
        
        if (fittingFunction === '' || fittingFunction == '-1')
            Ext.Msg.alert('Form incomplete', 'Please select a function.');
        else {
            data = getDataInCols(store, xChoice.getValue(), yChoice.getValue());
            makeFittingRequest({ 'actionID': 1, 'actionName': 'sendData', 'functionID': FunctionSelect.getValue(),
                                 'xData': JSON.stringify(data.x), 'yData': JSON.stringify(data.y) }, doFitInstruction);
        }
    }
    function getCheckedIndices() {
        return $('#legendSeries input[type=checkbox]:checked').map(function() { if (this.checked) return $('#legendSeries li input').index(this); });
    }
    function fitSeries (button, event) {
        var checkedIndices = getCheckedIndices();
    
        var dataSeries = globalPlots.plot[checkedIndices[0]];
        var functionSeries = globalPlots.plot[checkedIndices[1]];
        
        if (typeof dataSeries == 'undefined' || typeof functionSeries == 'undefined')
            Ext.Msg.alert('Form incomplete', 'Please select at least one data series and at least one function.');
        else {
            var dataData = dataPointsToCols(dataSeries.data);
            var functionData = dataPointsToCols(functionSeries.data);

            data = getDataInCols(store, xChoice.getValue(), yChoice.getValue());
            makeFittingRequest({ 'actionID': 3, 'actionName': 'sendData', 'legendIndex': checkedIndices[1],
                                 'functionID': functionSeries.functionID, 'functionParams': JSON.stringify(functionSeries.functionParams),
                                 'dataData': JSON.stringify(dataData), 'functionData': JSON.stringify(functionData) }, doFitInstruction);
            updateLegend();
        }
    }
    
    function doFitInstruction(responseObject) {
        responseJSON = Ext.decode(responseObject.responseText);
        
        switch (responseJSON['dataType']) {
            case 'askPoint':
                askPoint(responseJSON);
                break;
            case 'askDrag':
                askDrag(responseJSON);
                doPlotting(responseJSON);
                break;
            case 'doingDrag':
                doPlotting(responseJSON, plotDataSeries.length - 1);
                break;
            case 'doFit':
                doPlotting(responseJSON, responseJSON.legendIndex);
                break;
            default:
                doPlotting(responseJSON);
        }
        allowNextRequest = true;
    }
    function askPoint(responseJSON) {
        updateFittingStatus(responseJSON);
        
        $('#PlotContainer').one('plotclick', function (event, pos, item) {
            updateFittingStatus();
            makeFittingRequest({ 'actionID': 2, 'actionName': 'sendPoint', 'dataType': 'askPoint',
                                 'xPos': pos.x, 'yPos': pos.y, 'xID': responseJSON['xID'], 'yID': responseJSON['yID'] }, doFitInstruction);
        });
    }
    function askDrag(responseJSON) {
        updateFittingStatus(responseJSON);

        $('#PlotContainer').one('dragstart', { 'responseJSON': responseJSON }, onDragStart);
        $('#PlotContainer').bind('drag', function() {}); // To trigger dragstart/dragend events
        $('#PlotContainer').one('dragend', function (event) {
            $('#PlotContainer').unbind('plothover', onDrag);
            updateFittingStatus();
            console.log('End');
        });
    }
    function onDragStart (event) {
        console.log('Start');
        
        pos = event2pos(event);
        /*
        makeFittingRequest({ 'actionID': 2, 'actionName': 'sendPoint', 'dataType': 'askDrag',
                             'xPosstart': pos.x, 'yPosstart': pos.y, 'xIDstart': responseJSON['xIDstart'], 'yIDstart': responseJSON['yIDstart'],
                             'xPosend':   pos.x, 'yPosend':   pos.y, 'xIDend':   responseJSON['xIDend'],   'yIDend':   responseJSON['yIDend'] },
                             function() {});*/
        makeFittingRequest({ 'actionID': 2, 'actionName': 'sendPoint', 'dataType': 'askDrag',
                             'xPos': pos.x, 'yPos': pos.y, 'xID': responseJSON['xIDstart'], 'yID': responseJSON['yIDstart'] },
                             function() {});
        makeFittingRequest({ 'actionID': 2, 'actionName': 'sendPoint', 'dataType': 'askDrag',
                             'xPos': pos.x, 'yPos': pos.y + 0.00001, 'xID': responseJSON['xIDend'], 'yID': responseJSON['yIDend'] },
                             function() {}); // To prevent undefined on backend
        $('#PlotContainer').bind('plothover', { 'responseJSON': responseJSON }, onDrag);
    }
    function onDrag (event, pos, item) {
//        pos = event2pos(event);
        //console.log(event.data.responseJSON);
        //console.log(responseJSON);
        
        if (allowNextRequest) {
        //    console.log('Request');
            makeFittingRequest({ 'actionID': 2, 'actionName': 'sendPoint', 'dataType': 'askDrag',
                                 'xPos': pos.x, 'yPos': pos.y, 'xID': event.data.responseJSON['xIDend'], 'yID': event.data.responseJSON['yIDend'] },
                                 doFitInstruction);
            allowNextRequest = false;
        }
        //else
        //    console.log('No request');
    }
    function event2pos (event) {
        var offset = plot.offset(),
            plotOffset = plot.getPlotOffset(),
            axes = plot.getAxes(),
            pos = { pageX: event.pageX, pageY: event.pageY },
            canvasX = event.pageX - offset.left - plotOffset.left,
            canvasY = event.pageY - offset.top - plotOffset.top;
        pos.x = axes.xaxis.c2p(canvasX);
        pos.y = axes.yaxis.c2p(canvasY);
        
        return pos;
    }
    
    function doPlotting (responseJSON, replaceIndex) {        
        fitpoints = responseJSON.fit;
        
        FunctionName = FunctionSelectStore.getById(FunctionSelect.getValue()).data.name;
        
        newPlotData = {
            label:    xChoice.getValue() + ' vs. ' + yChoice.getValue() + ': ' + FunctionName,
            data:     fitpoints,
            points:   { show: false },
            lines:    { show: true },
            
            functionID: responseJSON.functionID,
            functionParams: responseJSON.functionParams,
            functionInfo: responseJSON.functionInfo,
        };

        var plotHoverDataSeries = plotDataSeries;
                //console.log('p',plotDataSeries, residplotDataSeries);
        if (replaceIndex)
            plotHoverDataSeries[replaceIndex] = newPlotData;
        else
            plotHoverDataSeries.push(newPlotData);

//console.log('ph', plotHoverDataSeries);

        //plot = $.plot($('#PlotContainer'), plotHoverDataSeries, plotOptions);
        plot.setData(plotHoverDataSeries);
        //plot.setupGrid();
        plot.draw();
        
        residpoints = responseJSON.resid;
        
        newResidPlotData = {
            label:    xChoice.getValue() + ' vs. ' + yChoice.getValue() + ': Resid 1',
            data:     residpoints,
            points:   { show: true },
            lines:    { show: true },
        };

        var residplotHoverDataSeries = residplotDataSeries;
                //console.log('rp',plotDataSeries, residplotDataSeries);
        if (replaceIndex)
            residplotHoverDataSeries[replaceIndex] = newResidPlotData;
        else
            residplotHoverDataSeries.push(newResidPlotData);

//console.log('rph', residplotHoverDataSeries);

        //residplot = $.plot($('#ResidPlotContainer'), residplotHoverDataSeries, residplotOptions);
        residplot.setData(residplotHoverDataSeries);
        residplot.axis()
        //residplot.setupGrid();
        residplot.draw();
        
        
                //console.log(plotDataSeries, residplotDataSeries);
                //console.log(plot.getData(), residplot.getData());
    }
    
    function updateFittingStatus(responseJSON) {
        var statusBar = $('#ChartStatusContainer');
        if (responseJSON) {
            statusBar.slideDown();
            statusBar.html('<p><strong>' + responseJSON['messageTitle'] + ':</strong> ' + responseJSON['messageText'] + '</p>');
        }
        else
            statusBar.slideUp();
    }
    
    function clearCurve (button, event) {
        var checkedIndices = getCheckedIndices();
        
        if (checkedIndices.length == 0) {
            Ext.Msg.alert('Error in clearing curve', 'Please select at least one curve to clear.');
        }
        else if (jQuery.inArray(0, checkedIndices) !== -1) {
            Ext.Msg.alert('Error in clearing curve', 'You can\'t clear the data itself, silly!');
        }
        else {
            Ext.Msg.confirm('Confirm clearing of curves',
                            'Are you sure you want to clear ' + ((checkedIndices.length > 1) ? 'these ' + checkedIndices.length + ' curves?'
                                                                                             : 'this curve?'),
                            function (confirm) {
                if (confirm == 'yes') {
                    var plotDataSeries = plot.getData();
                    var residplotDataSeries = residplot.getData();
                    var newPlotDataSeries = [], newResidplotDataSeries = [];
                    
                    for (var index = 0; index < plotDataSeries.length; index ++) {
                        if (jQuery.inArray(index, checkedIndices) == -1) {
                            newPlotDataSeries.push(plotDataSeries[index]);
                            newResidplotDataSeries.push(residplotDataSeries[index]);
                        }
                    }
                    
                    plot.setData(newPlotDataSeries);
                    plot.draw();
                    residplot.setData(newResidplotDataSeries);
                    residplot.draw();
                }
            });
        }
    }

    function makeFittingRequest (params, successFunction) {
        conn.request({
            url: 'fitting/' + idNum + '/',
            method: 'POST',
            params: params,
            success: successFunction,
            failure: function () {
                Ext.Msg.alert('Error: Failed request');
            }
        });
    }


    var FittingPanel = new Ext.FormPanel({
        title:          'Fitting tools',
        
        defaultType:    'textfield',
        labelWidth:     80,
        defaults:       { anchor: '-20', msgTarget: 'side' },
        
        autoWidth:      true,
        autoHeight:     true,
        bodyStyle:      'padding: 10px;',

        id:             'FittingPanel',
        items:          [ FunctionSelect, CreateFunctionButton, FitThisSeriesButton, ClearThisCurveButton ],
        tools:          [ { id: 'gear' }, { id: 'help' } ],
    });
    
    
    
    
    
// [ TAB PANELS ]

    var ToolsPanel = new Ext.Panel({
        title:          'Tools',
        region:         'east',
        collapsible:    true,
        
        minWidth:       200,
        layout:         'accordion',
        layoutConfig:   { animate: true, },
        
        id:             'ToolsPanel',
        items:          [ FittingPanel ],
    });
    
    /* Holds the chart and the two combo boxes */
    var ChartPanel = new Ext.Panel({
        title:          'Chart',
        region:         'center',
        
        layout:         'table',
        layoutConfig:   { columns: 3, tableAttrs: { valign: 'top' } },
        
        minWidth:       755,
        width:          900,
        
        id:             'ChartPanel',
        items:          [ ChartStatusContainer, yChoiceContainer, ChartContainer, ChartInfoContainer, xyCornerContainer, xChoiceContainer, yResidContainer, ResidChartContainer ],
        tools:          [{
                            id: 'refresh',
                            qtip: 'Refresh chart',
                            handler: activateChart,
                        }],
    });
    
    
    
    /* Holds the chart container and the other tool panels */
    var ChartTabPanel = new Ext.Panel({
//      title:          'Chart tab',
//      autoWidth:      true,
        height:         808, //588, // why not auto!?
        
        layout:         'border',
        defaults:       { split: true },
        
        id:             'ChartTabPanel',
        items:          [ ChartPanel, ToolsPanel ],
    });
    
    

    /* Create and initialize tabs */
    var tabs = new Ext.TabPanel({
       renderTo:        'tabs',
       activeTab:       0,
       defaults:        { autoWidth: true, autoHeight: true },
       layoutOnTabChange: true,
    });
    tabs.add({
        id:             'DataTab',
        title:          'Data',
        items:          [ DataTabPanel ],
    }).show();
    tabs.add({
        listeners:      { activate: function() { activateChart(); } },
        id:             'ChartTab',
        title:          'Chart',
        items:          [ ChartTabPanel ],
    }).show();
    
    tabs.setActiveTab('ChartTab');

    tabs.render();
    var first = true;


    GridPanel.on('rowcontextmenu', displayGridRowContextMenu);
    PlotContainer.getEl().on('contextmenu', displayPlotContextMenu);



    /* Draws the chart when the user activates the chart tab. If no choice is specified for the graph, it defaults to A4 and Detector */
    function activateChart() {
        drawChart(store, xChoice.getValue(), yChoice.getValue(), 'PlotContainer');
    }

    /* When the user selects a new parameter from the comboboxes, the chart is redrawn with that choice in mind */
    function selection(selectedstore, value) {
        activateChart();
    }

    /* Retrieve data in json format via a GET request to the server. This is used anytime there is new data, and initially to populate the table. */
    function update() {
        conn.request({
            url: 'json/' + idNum + '/',
            method: 'GET',
            params: {},
            success: function (responseObject) {
                responseJSON = Ext.decode(responseObject.responseText);
                metadataObj = responseJSON.metadata;
                MetadataStore.loadData(metadataObj);
                if(first){
                    yChoice.setValue('Detector');
                    for( var i = 0; i< metadataObj.length; ++i){
                        if (metadataObj[i].name == 'Scan'){
                            xChoice.setValue(metadataObj[i].data.split(' ')[0]);
                        }
                    }
                }
                dataArray = responseJSON.data;
                reloadData();
                loadMask.hide();
            },
            failure: function () {
                Ext.Msg.alert('Error', 'Failed JSON request');
            }
        });
    }

    /* Same idea as in all_files.js, when new data comes, we must re-initialize our store to update the plot */
    function reloadData() {
        fieldData = dataArray[0];
        if (first) {
            xChoice.store = fieldData;
            yChoice.store = fieldData;
        }
        first = false;
        dataArray.splice(0, 1);
        gridColumns = [];
        storeFields = [];
        for (var i = 0; i < fieldData.length; ++ i) {
            gridColumns.push({ header: fieldData[i], width: 70, sortable: true, dataIndex: fieldData[i] });
            storeFields.push({ name: fieldData[i] });
        }

        store = new Ext.data.ArrayStore({
            fields: storeFields,
        });

        store.loadData(dataArray);
        colModel = new Ext.grid.ColumnModel({ columns: gridColumns });
        GridPanel.reconfigure(store, colModel);

        if (tabs.getActiveTab().getId() == 'ChartTab') {
            activateChart();
        }
    }
    
    var jsonpoints = {};

    /* Set up the stomp client, subscribe to channel of individual file ID so that we only receive update information about our specific file. */
    var stomp = new STOMPClient();
    stomp.onopen = function () {};
    stomp.onclose = function (c) {
        Ext.Msg.alert('Error', 'Lost connection, Code: ' + c);
    };
    stomp.onerror = function (error) {
        Ext.Msg.alert('Error', error);
    };
    stomp.onerrorframe = function (frame) {
        Ext.Msg.alert('Error', frame.body);
    };
    stomp.onconnectedframe = function () {
        stomp.subscribe('/updates/files/' + idNum);
    };
    stomp.onmessageframe = function (frame) {
        // Ext.Msg.alert('Success', 'OMG we got updates!!!!1!!!111');
        update();
    };
    stomp.connect('localhost', 61613);
    update();
});

/* Gets data from the Store to draw the chart */
function getData(store, xChoice, yChoice) {
    var dataResults = [];

    for (var recordIndex = 0; recordIndex < store.getCount(); recordIndex ++ ) {
        var record = store.getAt(recordIndex);
        
        // Calculate error bars with square roots; not included in data file as it should be
        var data = [ +record.get(xChoice), +record.get(yChoice), +Math.sqrt(record.get(yChoice)) ]; // + to convert string to number
        
        dataResults.push(data);
    }
    
    return dataResults;
}

/* Gets data from the Store to draw the chart */
function getDataInCols(store, xChoice, yChoice) {
    var dataResults = { x: [], y: [] };

    for (var recordIndex = 0; recordIndex < store.getCount(); recordIndex ++ ) {
        var record = store.getAt(recordIndex);

        dataResults.x.push( +record.get(xChoice));
        dataResults.y.push( +record.get(yChoice));
    }
    
    return dataResults;
}

/* Gets data from the Store to draw the chart */
function dataPointsToCols(data) {
    var dataResults = { x: [], y: [], yerr: [] };

    for (var index = 0; index < data.length; index ++ ) {
        dataResults.x.push( +data[index][0] );
        dataResults.y.push( +data[index][1] );
        if (typeof data[index][2] !== 'undefined')
            dataResults.yerr.push( +data[index][2] );
    }
    
    if (dataResults.yerr.length == 0)
        delete dataResults.yerr;
    
    return dataResults;
}


function updateLegend() {
    if (typeof plot !== 'undefined')
        globalPlots.plot = plot.getData();
    LegendSeriesStore.loadData(globalPlots.plot);
    // should store already checked inputs
}

/* Initialize Flot generation, draw the chart with error bars */
function drawChart(store, xChoice, yChoice, chart) {
    var plotContainer = $('#' + chart);

    plotOptions = {
      hooks: { draw: [ updateLegend ] },
      
      legend: { show: false }, // because we have a custom legend
      series: { points: { show: true, radius: 3 } },
//      selection: { mode: 'xy' },
      crosshair: { mode: 'xy' },
      zoom: { // plugin
          interactive: true,
          //recenter: true,
          selection: 'xy',
          //trigger: null,
          amount: 1.25,
      },
      pan: { // plugin
          interactive: true,
      },
      grid: { hoverable: true, clickable: true },
      //yaxis: { autoscaleMargin: null },
    };

    var seriesData = getData(store, xChoice, yChoice);
    
    var seriesPointsOptions = {
        show: true,
        errorbars: 'y',
        yerr: { show: true, upperCap: '-', lowerCap: '-' },
    };
    
    plotDataSeries = [{
        label:    xChoice + ' vs. ' + yChoice + ': Series 1',
        data:     seriesData,
        points:   seriesPointsOptions,
        lines:    { show: false },
        color:    'rgb(255, 51, 51)',
    }];
    globalPlots.plot = plotDataSeries;


    plot = $.plot(
        plotContainer,
        plotDataSeries,
        plotOptions); // Compass rose for panning
    plot.addRose();

prevp={x:0,y:0};q=0;
    plotContainer.bind('plothover', function (event, pos, item) {
//    console.log(pos.pageX, pos.pageY, hypot(prevp.pageX - pos.pageX, prevp.pageY - pos.pageY), q++);
        $('#MIC-mx').text(pos.x.toPrecision(5));
        $('#MIC-my').text(pos.y.toPrecision(5));
        $('#MIC-px').text(pos.pageX);
        $('#MIC-py').text(pos.pageY);
        prevp = pos;

        
        if (item) {
            mouseX = item.pageX;
            mouseY = item.pageY;
            
            $('#MIC-dx').text(item.datapoint[0].toPrecision(5));
            $('#MIC-dy').text(item.datapoint[1].toPrecision(5));
            if (item.datapoint[2])
                $('#MIC-de').text(item.datapoint[2].toPrecision(5));
            $('#MIC-d').css({ display: 'block' }); //, left: mouseX + 3, top: mouseY + 3 });
        }
        else
            $('#MIC-d').css({ display: 'none' });
    });
    
    plotContainer.bind('plotclick', function (event, pos, item) {
        var previousPoints = [];

        if (item) {
            plot.highlight(item.series, item.datapoint);
            previousPoints.push(item);
        }
        else {
            for (i in previousPoints)
                plot.unhighlight(previousPoints[i].series, previousPoints[i].datapoint);
            previousPoints = [];
        }
    });
    /*
    plotContainer.bind('plotselected', function (event, ranges) {
        var extension = {};

        if (dragCheckState == 'dragCheckZoom') {
            // clamp the zooming to prevent eternal zoom
            if (ranges.xaxis.to - ranges.xaxis.from < 0.01)
                ranges.xaxis.to = ranges.xaxis.from + 0.01;
            if (ranges.yaxis.to - ranges.yaxis.from < 0.01)
                ranges.yaxis.to = ranges.yaxis.from + 0.01;
            
            
            // do the zooming
            extension = {
                            pan:   { interactive: true },
                            zoom:  { interactive: true  },
                            xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
                            yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to },
                        };
        }
        else {
            var newXdelta = ranges.xaxis.to - ranges.xaxis.from;
            var newXmin = plot.getAxes().xaxis.min + newXdelta;
            var newXmax = plot.getAxes().xaxis.max + newXdelta;
            var newYdelta = ranges.yaxis.to - ranges.yaxis.from;
            var newYmin = plot.getAxes().yaxis.min + newYdelta;
            var newYmax = plot.getAxes().yaxis.max + newYdelta;
            
            extension = {
                            pan:   { interactive: true  },
                            zoom:  { interactive: true },
                            xaxis: { min: newXmin, max: newXmax },
                            yaxis: { min: newYmin, max: newYmax },
                        };
        }
        plot = $.plot(plotContainer, plotData,
                      $.extend(true, {}, plotOptions, extension));
    });*/

// RESID

    var residplotContainer = $('#Resid' + chart);

    residplotOptions = {
      legend: { show: false }, // because we have a custom legend
      series: { points: { show: true, radius: 3 } },
//      selection: { mode: 'xy' },
      crosshair: { mode: 'xy' },
      zoom: { // plugin
          interactive: true,
          //recenter: true,
          selection: 'xy',
          //trigger: null,
          amount: 1.25,
      },
      pan: { // plugin
          interactive: true,
      },
      grid: { hoverable: true, clickable: true },
      //yaxis: { autoscaleMargin: null },
    };
    
    var residseriesPointsOptions = {
        show: true,
    };

    residplotDataSeries = [{
        label:    '',
        data:     [],
        points:   residseriesPointsOptions,
        lines:    { show: true },
        color:    'rgb(255, 51, 51)',
    }];
    globalPlots.residplot = residplotDataSeries;

    residplot = $.plot(
        residplotContainer,
        residplotDataSeries,
        residplotOptions);
    
    // Copy initial x-axis scale on plot to residplot
    var plotInitialAxesScales = plot.getAxesScales();
    residplot.axis([ plotInitialAxesScales[0], plotInitialAxesScales[1], null, null]);

    plotContainer.bind('plotzoom', function (event, plot, limits) {
        residplot.axis([ limits[0], limits[1], null, null ]);
    });
    plotContainer.bind('plotpan', function (event, plot, ranges) {
        residplot.pan(ranges);
    });
    residplotContainer.bind('plotzoom', function (event, plot, limits) {
        plot.axis([ limits[0], limits[1], null, null ]);
    });
    residplotContainer.bind('plotpan', function (event, plot, ranges) {
        plot.pan(ranges);
    });
}

function hypot(x, y) {
  return Math.sqrt(x * x + y * y);
}

function zoomPlot (menuItem, event) {
    if (menuItem.data == 0) {
        plot.axis();
        residplot.axis();
    }
    else {
        plot.zoom({ amount: menuItem.data, recenter: true });
        residplot.zoom({ amount: menuItem.data, recenter: true });
    }
}

/*
dragCheckState = 'dragCheckPan';

function dragCheckHandler(menuItem, checked) {
    if (checked === true) {
        dragCheckState = menuItem.id;
    }
    var iconCls = 'icon-radio-' + ((checked === true) ? '' : 'un') + 'checked';
  //menuItem.setIconClass(iconCls);
}
*/

function dragCheckHandler(menuItem, checked) {}

function scaleCheckHandler(menuItem, checked) {}
