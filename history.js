class History_Manager{
    constructor(){
        this.history = [];
        this.redo_history = []
        this.prev_data = []
        this.new_data = []
        this.prev_selection = null;
        this.new_selection = null;
    }

    add_history(type, args){
        this.redo_history = []
        if(type == "pen-stroke"){
            if (this.prev_data.length == 0){ return; }
            this.history.push(new Pen_Stroke(this.prev_data, this.new_data, state.layer_manager.current_layer.index));
            this.prev_data = [];
            this.new_data = [];
        }
        if(type == "selection"){
            if (this.prev_selection == null){ return; }
            this.history.push(new Selection_History(this.prev_selection, this.new_selection));
            this.prev_selection = null;
            this.new_selection = null;
        }
        if(type == "add-layer"){
            this.history.push(new Add_Layer(...args));
        }

        if(type == "delete-layer"){
            this.history.push(new Delete_Layer(...args));
        }

        if(type == "layer-visibility"){
            this.history.push(new Layer_Visibility(...args));
        }

        if(type == "swap-layers"){
            this.history.push(new Swap_Layers(...args))
        }

        if(type == "layer-settings"){
            this.history.push(new Layer_Settings_History(...args))
        }
    }

    undo_last(){
        if(this.history.length == 0) { return; }
        this.history[this.history.length - 1].undo();
        this.redo_history.push(this.history.pop());
        this.prev_data = []
        state.preview_canvas.redraw();
    }
    
    redo_last(){
        if(this.redo_history.length == 0) { return; }
        this.redo_history[this.redo_history.length - 1].redo();
        this.history.push(this.redo_history.pop());
        state.preview_canvas.redraw();
    }

    push_prev_data(data){
        this.prev_data.push(get_data_copy(data));
    }

    push_new_data(data){
        this.new_data.push(get_data_copy(data));
    }
}

function get_data_copy(data){
    var copy = new Pixel_Data();
    copy.pos = data.pos;
    copy.rgba = data.rgba
    return copy;
}

class Pen_Stroke{
    constructor(prev_data, new_data, layer){
        this.prev_data = prev_data;
        this.new_data = new_data;
        this.layer = layer;
    }

    undo(){
        for(var i = 0; i < this.prev_data.length; i++){
            var pos = this.prev_data[i].pos;
            state.layer_manager.layers[this.layer].draw_pixel(rgba(this.prev_data[i].rgba), ...pos);
            state.layer_manager.layers[this.layer].data[pos[0]][pos[1]] = get_data_copy(this.prev_data[i]);
        }
    }

    redo(){
        for(var i = 0; i < this.new_data.length; i++){
            var pos = this.new_data[i].pos;
            state.layer_manager.layers[this.layer].draw_pixel(rgba(this.new_data[i].rgba), ...pos);
            state.layer_manager.layers[this.layer].data[pos[0]][pos[1]] = get_data_copy(this.new_data[i]);
        }
        
    }
}

class Selection_History{
    constructor(prev_selection, new_selection){
        this.prev_selection = prev_selection;
        this.new_selection = new_selection;
    }

    undo(){
        if (!this.prev_selection.exists) {
            state.current_selection.clear();
            return;
        }
        state.current_selection.x = this.prev_selection.x;
        state.current_selection.y = this.prev_selection.y;
        state.current_selection.w = this.prev_selection.w;
        state.current_selection.h = this.prev_selection.h;
        state.current_selection.true_w = this.prev_selection.true_w;
        state.current_selection.true_h = this.prev_selection.true_h;
        state.current_selection.exists = this.prev_selection.exists;
        state.current_selection.draw_selection(this.prev_selection.x - state.canvas_wrapper.offsetLeft,
                                               this.prev_selection.y - state.canvas_wrapper.offsetTop, 
                                               this.prev_selection.x + this.prev_selection.true_w - state.canvas_wrapper.offsetLeft, 
                                               this.prev_selection.y + this.prev_selection.true_h - state.canvas_wrapper.offsetTop)
    }

    redo(){
        if (!this.new_selection.exists) {
            state.current_selection.clear();
            return;
        }
        state.current_selection.x = this.new_selection.x;
        state.current_selection.y = this.new_selection.y;
        state.current_selection.w = this.new_selection.w;
        state.current_selection.h = this.new_selection.h;
        state.current_selection.true_w = this.new_selection.true_w;
        state.current_selection.true_h = this.new_selection.true_h;
        state.current_selection.exists = this.new_selection.exists;
        state.current_selection.draw_selection(this.new_selection.x - state.canvas_wrapper.offsetLeft,
                                               this.new_selection.y - state.canvas_wrapper.offsetTop, 
                                               this.new_selection.x + this.new_selection.true_w - state.canvas_wrapper.offsetLeft, 
                                               this.new_selection.y + this.new_selection.true_h - state.canvas_wrapper.offsetTop)
    }
}

class Add_Layer{
    constructor(index){
        this.index = index;
    }

    undo(){
        state.layer_manager.change_layer(this.index + 1);
        state.layer_manager.layers[this.index].delete();
        state.layer_manager.layers.splice(this.index, 1);
        state.layer_manager.update_layer_indices();
        state.layer_manager.current_layer
    }

    redo(){
        state.layer_manager.add_layer();
    }
}

class Delete_Layer{
    constructor(layer_state){
        this.layer_state = layer_state;
    }

    undo(){
        var new_layer = new Layer(this.layer_state.index, state.main_canvas.w, state.main_canvas.h);
        new_layer.index = this.layer_state.index;
        new_layer.name_elem.innerHTML = this.layer_state.name;
        new_layer.data = this.layer_state.data;
        
        for(var x = 0; x < state.layer_manager.w; x++){
            for(var y = 0; y < state.layer_manager.h; y++){
                new_layer.render_ctx.fillStyle = rgba(new_layer.data[x][y].rgba);
                new_layer.render_ctx.fillRect(x, y, 1, 1)
            }
        }
        
        state.layer_manager.layers.splice(new_layer.index, 0, new_layer);
        state.layer_manager.update_layer_indices();
        state.layer_manager.change_layer(new_layer.index);
        new_layer.redraw();

        if(!this.layer_state.visible){
            new_layer.visible = false;
            new_layer.canvas.style.display = "none";
            new_layer.visibility_icon.className = "far fa-circle";
        }
    }

    redo(){
        state.layer_manager.layers[this.layer_state.index].delete();
        state.layer_manager.layers.splice(this.layer_state.index, 1);
        state.layer_manager.update_layer_indices();
        state.layer_manager.change_layer(0)
    }
}

class Layer_Visibility{
    constructor(index){
        this.undo = this.redo = function(){
            state.layer_manager.layers[index].toggle_visibility(state.layer_manager.layers[index]).call();
        }
    }
}

class Swap_Layers{
    constructor(layer_a, layer_b){
        this.undo = this.redo = function(){
            state.layer_manager.swap_layers(layer_a, layer_b);
        }
    }
}

class Layer_Settings_History{
    constructor(prev_settings, new_settings, layer){
        this.prev_settings = prev_settings;
        this.new_settings = new_settings;
        this.layer = layer;
    }

    undo(){
        this.layer.opacity = this.prev_settings.opacity;
        this.layer.name_elem.innerHTML = this.prev_settings.name;
    }
    
    redo(){
        this.layer.opacity = this.new_settings.opacity;
        this.layer.name_elem.innerHTML = this.new_settings.name;
    }
}