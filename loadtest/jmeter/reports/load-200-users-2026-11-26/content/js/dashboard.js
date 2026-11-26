/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 99.99763738600387, "KoPercent": 0.002362613996125313};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.985162784104333, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9994753410283316, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.9997376705141658, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.999211356466877, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9989229940764675, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [1.0, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [0.9991922455573505, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [1.0, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.9986691236691236, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.6878238341968912, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9992130115424974, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.9994753410283316, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.9992130115424974, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9986807387862797, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9978712080894092, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9989159891598915, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 42326, 1, 0.002362613996125313, 46.78341917497505, 2, 3884, 11.0, 47.0, 267.0, 1165.950000000008, 235.50555295898155, 427.47566668196794, 86.7216124620251], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 4950, 0, 0.0, 8.606060606060604, 2, 267, 6.0, 12.0, 17.0, 70.48999999999978, 27.633870751641286, 124.35241838238579, 6.044909226921532], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 1906, 0, 0.0, 17.577124868835245, 4, 1312, 11.0, 25.299999999999955, 34.649999999999864, 143.72000000000025, 10.751414437130173, 11.06759816094969, 5.020963160470219], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 1906, 0, 0.0, 16.422350472193088, 4, 1167, 11.0, 25.0, 34.0, 132.65000000000032, 10.751353790613718, 10.731555924949232, 5.052432945058664], "isController": false}, {"data": ["S07 Medications GET /api/medications", 1902, 0, 0.0, 19.173501577287052, 5, 1022, 13.0, 28.0, 39.84999999999991, 144.94000000000005, 10.795041772611697, 14.14417692240567, 5.241618518434435], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 1857, 0, 0.0, 22.424878836833592, 5, 792, 13.0, 32.0, 50.09999999999991, 211.0, 10.69595719313201, 9.590766556198414, 5.402213006934805], "isController": false}, {"data": ["B2 Login page /login", 4913, 0, 0.0, 8.472420109912456, 2, 265, 5.0, 12.0, 18.0, 75.0, 27.523346946549918, 74.21089933537532, 6.155123487070246], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 1857, 0, 0.0, 18.96230479267634, 5, 1986, 12.0, 27.0, 38.0, 147.26000000000022, 10.696018800110588, 12.431951791237557, 5.485806769681365], "isController": false}, {"data": ["B3 Signup page /signup", 4884, 0, 0.0, 8.91605241605241, 2, 256, 6.0, 13.0, 18.0, 94.59999999999854, 27.576705475816745, 84.74989466054228, 6.193986581482276], "isController": false}, {"data": ["B4 API ready /api/health/ready", 4884, 1, 0.020475020475020474, 15.112407862407869, 2, 1605, 7.0, 20.0, 30.0, 150.4499999999989, 27.576861184043366, 13.923210057240055, 6.463326840010164], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 1930, 0, 0.0, 707.8906735751291, 187, 3884, 587.0, 1252.7000000000003, 1512.0, 2705.5600000000013, 10.784050780027714, 10.753766472916947, 3.7491426539940105], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 1906, 0, 0.0, 21.42077649527807, 5, 518, 15.0, 31.0, 41.0, 156.86000000000013, 10.750747363077444, 13.82951639087089, 5.251624721501495], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 1906, 0, 0.0, 16.093389296957, 4, 1428, 10.0, 25.0, 35.0, 108.65000000000032, 10.751414437130173, 8.716761873233716, 5.094459157599039], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 1906, 0, 0.0, 20.692025183630633, 5, 1367, 13.0, 31.0, 43.0, 183.93000000000006, 10.751111211389635, 9.640439651209359, 5.43028770221791], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1895, 0, 0.0, 24.28865435356201, 6, 2009, 15.0, 33.0, 47.399999999999636, 206.71999999999935, 10.802090874370828, 13.98400603841155, 7.253797075668789], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 1879, 0, 0.0, 25.129856306546028, 6, 1166, 15.0, 34.0, 47.0, 251.4000000000001, 10.771179785264291, 14.028000356125355, 5.261486789325698], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 1845, 0, 0.0, 16.27750677506776, 4, 2118, 9.0, 21.0, 30.0, 120.53999999999996, 10.661966540495248, 6.465899630515184, 5.2288094769424145], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["503/Service Unavailable", 1, 100.0, 0.002362613996125313], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 42326, 1, "503/Service Unavailable", 1, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["B4 API ready /api/health/ready", 4884, 1, "503/Service Unavailable", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
