var DiscographFsm = machina.Fsm.extend({
    initialize: function(options) {
        var self = this;
        $(window).on('discograph:request-network', function(event) {
            self.requestNetwork(event.entityKey, event.pushHistory);
        });
        $(window).on('discograph:request-random', function() {
            self.requestRandom();
        });
        $(window).on('discograph:select-entity', function(event) {
            self.selectEntity(event.entityKey, event.fixed);
        });
        $(window).on('discograph:select-next-page', function() {
            self.selectNextPage();
        });
        $(window).on('discograph:select-previous-page', function() {
            self.selectPreviousPage();
        });
        $(window).on('discograph:show-network', function() {
            self.showNetwork();
        });
        $(window).on('discograph:show-radial', function() {
            self.showRadial();
        });
        $(window).on('popstate', function(event) {
            dg_history_onPopState(event.originalEvent);
        });
        $(window).on('resize', $.debounce(100, function(event) {
            var w = window,
                d = document,
                e = d.documentElement,
                g = d.getElementsByTagName('body')[0];
            dg.dimensions = [
                w.innerWidth || e.clientWidth || g.clientWidth,
                w.innerHeight|| e.clientHeight|| g.clientHeight,
            ];
            d3.select("#svg")
                .attr("width", dg.dimensions[0])
                .attr("height", dg.dimensions[1]);
            d3.selectAll('.centered')
                .attr('transform', "translate(" +
                    dg.dimensions[0] / 2 + "," +
                    dg.dimensions[1] / 2 + ")");
            dg.network.forceLayout.size(dg.dimensions).start();
        }));
        $('#svg').on('mousedown', function() {
            self.selectEntity(null);
        });
        this.loadInlineData();
        this.toggleRadial(false);
    },
    namespace: 'discograph',
    initialState: 'uninitialized',
    states: {
        'uninitialized': {
            'request-network': function(entityKey) {
                this.requestNetwork(entityKey);
            },
            'request-random': function() {
                this.requestRandom();
            },
            'load-inline-data': function() {
                var params = {'roles': $('#filter select').val()};
                this.handle('received-network', dgData, false, params);
                this.deferAndTransition('requesting');
            }
        },
        'viewing-network': {
            '_onEnter': function() {
                this.toggleNetwork(true);
            },
            '_onExit': function() {
                this.toggleNetwork(false);
            },
            'request-network': function(entityKey) {
                this.requestNetwork(entityKey);
            },
            'request-random': function() {
                this.requestRandom();
            },
            'show-radial': function() {
                if (dg.network.pageData.selectedNodeKey) {
                    this.requestRadial(dg.network.pageData.selectedNodeKey);
                }
            },
            'select-entity': function(entityKey, fixed) {
                dg.network.pageData.selectedNodeKey = entityKey;
                if (entityKey !== null) {
                    var selectedNode = dg.network.data.nodeMap.get(entityKey);
                    var currentPage = dg.network.pageData.currentPage;
                    if (-1 == selectedNode.pages.indexOf(currentPage)) {
                        dg.network.pageData.selectedNodeKey = null;
                    }
                }
                entityKey = dg.network.pageData.selectedNodeKey;
                if (entityKey !== null) {
                    var nodeOn = dg.network.layers.root.selectAll('.' + entityKey);
                    var nodeOff = dg.network.layers.root.selectAll('.node:not(.' + entityKey + ')');
                    var linkKeys = nodeOn.datum().links;
                    var linkOn = dg.network.selections.link.filter(function(d) {
                        return 0 <= linkKeys.indexOf(d.key);
                    });
                    var linkOff = dg.network.selections.link.filter(function(d) {
                        return linkKeys.indexOf(d.key) == -1;
                    });
                    var node = dg.network.data.nodeMap.get(entityKey);
                    var url = 'http://discogs.com/' + node.type + '/' + node.id;
                    $('#entity-name').text(node.name);
                    $('#entity-link').attr('href', url);
                    $('#entity-details').removeClass('hidden').show(0);
                    nodeOn.moveToFront();
                    nodeOn.classed('selected', true);
                    if (fixed) {
                        //nodeOn.each(function(d) { d.fixed = true; });
                        node.fixed = true;
                    }
                    linkOn.classed('selected', true);
                } else {
                    var nodeOff = dg.network.layers.root.selectAll('.node');
                    var linkOff = dg.network.selections.link;
                    $('#entity-details').hide();
                }
                if (nodeOff) {
                    nodeOff.classed('selected', false);
                    nodeOff.each(function(d) { d.fixed = false; });
                }
                if (linkOff) {
                    linkOff.classed('selected', false);
                }
            },
        },
        'viewing-radial': {
            '_onEnter': function() {
                this.toggleRadial(true);
                d3.select('#timelineLayer').remove();
                dg_timeline_chartRadial();
            },
            '_onExit': function() {
                d3.select('#timelineLayer').remove();
                this.toggleRadial(false);
            },
            'request-network': function(entityKey) {
                this.requestNetwork(entityKey);
            },
            'request-random': function() {
                this.requestRandom();
            },
            'show-network': function() {
                this.transition('viewing-network');
            },
        },
        'requesting': {
            '_onEnter': function(fsm, entityKey, pushHistory) {
                this.toggleLoading(true);
            },
            '_onExit': function() {
                this.toggleLoading(false);
            },
            'errored': function(error) {
                this.handleError(error);
            },
            'received-network': function(data, pushHistory, params) {
                var params = {'roles': $('#filter select').val()};
                var key = data.center.key;
                dg.network.data.json = JSON.parse(JSON.stringify(data));
                document.title = 'Disco/graph: ' + data.center.name;
                $(document).attr('body').id = key;
                if (pushHistory === true) {
                    dg_history_pushState(key, params);
                }
                dg.network.data.pageCount = data.pages;
                dg.network.pageData.currentPage = 1;
                if (1 < data.pages) {
                    $('#paging').fadeIn();
                } else {
                    $('#paging').fadeOut();
                }
                dg_network_processJson(data);
                dg_network_selectPage(1);
                dg_network_startForceLayout();
                this.selectEntity(dg.network.data.json.center.key, false);
                this.deferAndTransition('viewing-network');
            },
            'received-random': function(data) {
                this.requestNetwork(data.center, true);
            },
            'received-radial': function(data) {
                dg.timeline.data = data;
                dg.timeline.byYear = d3.nest()
                    .key(function(d) { return d.year; })
                    .key(function(d) { return d.category; })
                    .entries(data.results);
                dg.timeline.byRole = d3.nest()
                    .key(function(d) { return d.role; })
                    .rollup(function(leaves) { return leaves.length; })
                    .entries(dg.timeline.data.results);
                this.transition('viewing-radial');
            },
        },
    },
    handleError: function(error) {
        var message = 'Something went wrong!';
        var status = error.status;
        if (status == 0) {
            status = 404;
        } else if (status == 429) {
            message = 'Hey, slow down, buddy. Give it a minute.'
        }
        var text = [
            '<div class="alert alert-danger alert-dismissible" role="alert">',
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">',
            '<span aria-hidden="true">&times;</span>',
            '</button>',
            '<strong>' + status + '!</strong> ' + message,
            '</div>'
            ].join('');
        $('#flash').append(text);
        this.transition('viewing-network');
    },
    getNetworkURL: function(entityKey) {
        var entityType = entityKey.split('-')[0];
        var entityId = entityKey.split('-')[1];
        var url = '/api/' + entityType + '/network/' + entityId;
        var params = {'roles': $('#filter select').val()};
        if (params.roles) {
            url += '?' + decodeURIComponent($.param(params));
        }
        return url;
    },
    getRandomURL: function() {
        return '/api/random?' + Math.floor(Math.random() * 1000000);
    },
    getRadialURL: function(entityKey) {
        var entityType = entityKey.split("-")[0];
        var entityId = entityKey.split("-")[1];
        return '/api/' + entityType+ '/timeline/' + entityId;
    },
    loadInlineData: function() {
        if (dgData) { this.handle('load-inline-data'); }
    },
    requestNetwork: function(entityKey, pushHistory) {
        this.transition('requesting');
        var self = this;
        d3.json(this.getNetworkURL(entityKey), function(error, data) {
            if (error) {
                this.handleError(error);
            } else {
                self.handle('received-network', data, pushHistory);
            }
        });
    },
    requestRadial: function(entityKey) {
        this.transition('requesting');
        var self = this;
        d3.json(this.getRadialURL(entityKey), function(error, data) {
            if (error) {
                this.handleError(error);
            } else {
                self.handle('received-radial', data);
            }
        });
    },
    requestRandom: function() {
        this.transition('requesting');
        var self = this;
        d3.json(this.getRandomURL(), function(error, data) {
            if (error) {
                this.handleError(error);
            } else {
                self.handle('received-random', data);
            }
        });
    },
    selectEntity: function(entityKey, fixed) {
        this.handle('select-entity', entityKey, fixed);
    },
    selectNextPage: function() {
        var page = dg.network.pageData.currentPage + 1;
        if (dg.network.data.pageCount < page) {
            page = 1;
        }
        this.selectPage(page);
    },
    selectPreviousPage: function() {
        var page = dg.network.pageData.currentPage - 1;
        if (page == 0) {
            page = dg.network.data.pageCount;
        }
        this.selectPage(page);
    },
    selectPage: function(page) {
        dg_network_selectPage(page);
        dg_network_startForceLayout();
        this.selectEntity(dg.network.pageData.selectedNodeKey, true);
    },
    showNetwork: function() {
        this.handle('show-network');
    },
    showRadial: function() {
        this.handle('show-radial');
    },
    toggleNetwork: function(status) {
        if (status) {
            if (1 < dg.network.data.json.pages) {
                $('#paging').fadeIn();
            } else {
                $('#paging').fadeOut();
            }
            dg.network.layers.root.transition()
                .delay(250)
                .duration(1000)
                .style('opacity', 1)
                .each('end', function(d, i) {
                    dg.network.layers.link.selectAll('.link')
                        .classed('noninteractive', false);
                    dg.network.layers.node.selectAll('.node')
                        .classed('noninteractive', false);
                    dg.network.forceLayout.start()
                });
        } else {
            $('#paging').fadeOut();
            dg.network.forceLayout.stop()
            dg.network.layers.root.transition()
                .duration(250)
                .style('opacity', 0.333);
            dg.network.layers.link.selectAll('.link')
                .classed('noninteractive', true);
            dg.network.layers.node.selectAll('.node')
                .classed('noninteractive', true);
        }
    },
    toggleLoading: function(status) {
        if (status) {
            var input = dg_loading_makeArray();
            var data = input[0], extent = input[1];
            $('#page-loading')
                .removeClass('glyphicon-random')
                .addClass('glyphicon-animate glyphicon-refresh');
        } else {
            var data = [], extent = [0, 0];
            $('#page-loading')
                .removeClass('glyphicon-animate glyphicon-refresh')
                .addClass('glyphicon-random');
        }
        dg_loading_update(data, extent);
    },
    toggleRadial: function(status) {
        var self = this;
        if (status) {
            $('#entity-relations')
                .off('click')
                .on('click', function(event) { 
                    self.showNetwork();
                    event.preventDefault();
                });
            $('#entity-relations .glyphicon')
                .removeClass('glyphicon-eye-open')
                .addClass('glyphicon-eye-close');
        } else {
            $('#entity-relations')
                .off('click')
                .on('click', function(event) { 
                    self.showRadial();
                    event.preventDefault();
                });
            $('#entity-relations .glyphicon')
                .addClass('glyphicon-eye-open')
                .removeClass('glyphicon-eye-close');
        }
    },
});