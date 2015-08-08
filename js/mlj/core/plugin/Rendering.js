/**
 * MLJLib
 * MeshLabJS Library
 * 
 * Copyright(C) 2015
 * Paolo Cignoni 
 * Visual Computing Lab
 * ISTI - CNR
 * 
 * All rights reserved.
 *
 * This program is free software; you can redistribute it and/or modify it under 
 * the terms of the GNU General Public License as published by the Free Software 
 * Foundation; either version 2 of the License, or (at your option) any later 
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT 
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See theGNU General Public License 
 * (http://www.gnu.org/licenses/gpl.txt) for more details.
 * 
 */

/**
 * @file Defines the basic class to create a rendering plugin
 * @author Stefano Gabriele
 */

MLJ.core.plugin.Rendering = function (parameters, defaults) {
    MLJ.core.plugin.Plugin.call(this, parameters.name, parameters);

    //if is defined parameters.loadShader, this.shaders is an associative array
    //mapping the shader name with its code
    this.shaders = null;

    var _this = this;
    MLJ.core.setDefaults(_this.getName(), defaults);

    var pane = new MLJ.gui.component.Pane();
    var UID = MLJ.gui.generateUID();
    pane.$.css("position", "absolute").attr("id", UID);
    pane.$.hide();      

    var guiBuilder = new MLJ.core.plugin.GUIBuilder(pane);
    var tbBuilder = new MLJ.core.plugin.RenderingBarBuilder(
            MLJ.widget.TabbedPane.getRendToolBar());
    var renderingPane = MLJ.widget.TabbedPane.getRenderingPane();

    var btn = tbBuilder.Button(parameters);

    var group = MLJ.gui.makeGroup("rendButtons");
    if (btn instanceof MLJ.gui.component.CustomToggleButton) {
        group.addItem(btn);
        MLJ.gui.disabledOnSceneEmpty(btn);
    }
    
    //Shows the options pane of this rendering feature
    function _showOptionsPane() {
        renderingPane.children().each(function (key, val) {
            if ($(val).attr("id") === UID) {
                $(val).fadeIn();
            } else {
                $(val).fadeOut();
            }
        });
    } 

    if (parameters.toggle === true) {

        //Click on button
        btn.onToggle(function (on, event) {
            //show options pane
            
            //Apply rendering pass to all mesh
            if (event.ctrlKey === true) {                
                var passName = parameters.name;
                var ptr = MLJ.core.Scene.getLayers().iterator();                
                //get selected layer
                var selLayer = MLJ.core.Scene.getSelectedLayer();                
                //get this rendering pass paramters of selected layer
                var selParams = selLayer.overlaysParams.getByKey(passName);
                var layer;             
                //apply rendering pass with 'selParams' to all layers
                while (ptr.hasNext()) {
                    layer = ptr.next();    
                    if (layer.getThreeMesh().visible) {                        
                        layer.overlaysParams.set(passName,selParams);
                        layer.properties.set(passName, on);
                        _this._applyTo(layer, on);                        
                    }
                }
                
            } else { //Apply rendering pass to selected layer
                var selected = MLJ.core.Scene.getSelectedLayer();
                if (selected !== undefined) {
                    _this._applyTo(selected, on);
                    selected.properties.set(parameters.name, on);
                }
            }
        });

        //Clicked with mouse right button
        btn.onRightButtonClicked(function () {
            btn.toggle("off", true);
            var items = group.getItems();
            var item;

            for (var key in items) {
                item = items[key];
                if (item !== btn) {
                    item.toggle("on", true);
                }
            }
        });

        //Click on arrow
        btn.onArrowClicked(function () {
            _showOptionsPane();
        });             
        
        $(document).on("SceneLayerAdded SceneLayerReloaded",
                function (event, meshFile, layersNumber) {
                    //Check if the renderinfg fetaure is on by default
                    if (btn.isOn() === parameters.on) {
                        _this._applyTo(meshFile, btn.isOn());
                        meshFile.properties.set(parameters.name, btn.isOn());
                        update();
                    } else {
                        btn.toggle("off");
                    }
                    
                    //if the rendering pass need to be updated when a 
                    //new layer is added
                    if (parameters.updateOnLayerAdded) {
                        var ptr = MLJ.core.Scene.getLayers().iterator();
                        var layer, isOn;
                        while (ptr.hasNext()) {
                            layer = ptr.next();
                            isOn = layer.properties.getByKey(parameters.name);
                            reapplay(isOn,layer);                            
                        }
                    }

                });

        $(document).on("SceneLayerUpdated",
                function (event, meshFile) {
                    reapplay(btn.isOn(),meshFile);                    
                });

    } else {
        btn.onClick(function () {
            _showOptionsPane();
        });
        
        $(document).on("SceneLayerAdded SceneLayerReloaded",
                function (event, meshFile, layersNumber) {
                    _this._applyTo(meshFile, true);
                    update();
                });

    }

    $(document).on("SceneLayerSelected", function (event, meshFile) {
        update();

        if (parameters.toggle === true) {
            var val = meshFile.properties.getByKey(parameters.name);
            if (val === true) {
                btn.toggle("on");
            } else {
                btn.toggle("off");
            }
        }
    });

    //Prevents context menu opening
    $(document).ready(function () {
        $(this).on("contextmenu", function (e) {
            if (btn.$.find("img").prop("outerHTML") === $(e.target).prop("outerHTML")) {
                e.preventDefault();
            }
        });
    });

    function update() {
        var selected = MLJ.core.Scene.getSelectedLayer();
        var params = selected.overlaysParams.getByKey(_this.getName());
        var param;
        for (var key in params) {
            param = guiBuilder.params.getByKey(key);
            if (param !== undefined) {
                param._changeValue(params[key]);
            }
        }
    }

    function reapplay(applay, meshFile) {
        if (applay) {
            _this._applyTo(meshFile, false);
            _this._applyTo(meshFile, true);
        }
    }

    guiBuilder.setOnParamChange(function (paramProp, value) {
        var meshFile = MLJ.core.Scene.getSelectedLayer();
        var params = meshFile.overlaysParams.getByKey(_this.getName());
        params[paramProp] = value;
              
        if (parameters.global === true) {
            var iter = meshFile.overlays.iterator();
            var overlay;
            //Update the global paramter for all overlay layers
            while (iter.hasNext()) {
                overlay = iter.next();
                //check if overlay has this uniform defined
                if (overlay.material.uniforms[paramProp] !== undefined) {
                    overlay.material.uniforms[paramProp].value = value;
                }
            }

            MLJ.core.Scene.render();
            return;
        }

        var overlay = meshFile.overlays.getByKey(_this.getName());

        //if overlay undefined just return
        if (overlay === undefined) {
            return;
        }
        
        //is 'bindTo' property a uniform?
        if (overlay.material.uniforms !== undefined 
                && overlay.material.uniforms[paramProp] !== undefined) {
            overlay.material.uniforms[paramProp].value = value;
            MLJ.core.Scene.render();
            return;
        }
        
        //is 'bindTo' property a function?
        if(jQuery.isFunction(paramProp)) {
            paramProp(value, overlay);
        }

    });

    this._main = function () {
        //if loadShader property is setted, load shader files
        if (parameters.loadShader !== undefined) {

            //Prevent that the rendering pass will be applied if the shader
            //files are not completely loaded
            btn.$.hide();

            var pathBase = "./js/mlj/plugins/rendering/shaders/";
            //Set shader files path
            for (var i = 0, m = parameters.loadShader.length; i < m; i++) {
                parameters.loadShader[i] = pathBase + parameters.loadShader[i];
            }

            MLJ.util.loadFile(parameters.loadShader, function (results) {
                //Shader loaded
                _this.shaders = results;
                //Show button
                btn.$.show();
            });
        }
        _this._init(guiBuilder);
        renderingPane.append(pane.$);
    };

};

MLJ.extend(MLJ.core.plugin.Plugin, MLJ.core.plugin.Rendering);
