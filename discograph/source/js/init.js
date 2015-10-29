$(document).ready(function() {
    dg_svg_init();
    dg_network_init();
    dg_timeline_init();
    dg_typeahead_init();
    dg_events_init();
    if (dgData) {
        var params = {'roles': $('#filter select').val()};
        dg_history_replaceState(dgData.center.key, params);
        dg_network_handleAsyncData(dgData, false);
    }
    $('[data-toggle="tooltip"]').tooltip();
    (function() {
        var click = $.debounce(300, function() {
            var url = '/api/random?' + Math.floor(Math.random() * 1000000);
            if (!dg.network.isUpdating) {
                dg.network.layers.root.transition()
                    .style("opacity", 0.333);
                $("#page-loading")
                    .removeClass("glyphicon-random")
                    .addClass("glyphicon-animate glyphicon-refresh");
                d3.json(url, function(error, json) {
                    if (error) { dg_network_handleAsyncError(error); return; }
                    dg_network_navigate(json.center, true);
                });
            } else {
                dg_warn();
            }
        });
        $('#brand').on("click touchstart", function(event) {
            click();
            $(this).tooltip('hide');
            event.preventDefault();
        });
    }());
    $('#paging .next a').click(function(event) {
        $(this).trigger({
            type: 'discograph:network-select-page', 
            payload: {
                page: dg_network_getNextPage()
            },
        });
    });
    $('#paging .previous a').click(function(event) {
        $(this).trigger({
            type: 'discograph:network-select-page',
            payload: {
                page: dg_network_getPrevPage()
            },
        });
    });
    $('#filter-roles').multiselect({
        buttonWidth: "160px",
        enableFiltering: true,
        enableCaseInsensitiveFiltering: true,
        //includeSelectAllOption: true,
        inheritClass: true,
        enableClickableOptGroups: true,
        maxHeight: 400,
        nonSelectedText: 'Select relationships'
    });
    $('#filter').on('reset', function(event) {
        $('#filter-roles option:selected').each(function() {
            $(this).prop('selected', false);
        });
        $('#filter-roles').multiselect('refresh');
        event.preventDefault();
    });
    $('#filter').submit(function(event) {
        dg_network_navigate(dg.network.data.json.center.key, true);
        event.preventDefault();
    });
    $('#filter').fadeIn(3000);
    $(window).on('popstate', dg_history_onPopState);
    console.log('discograph initialized.');
});