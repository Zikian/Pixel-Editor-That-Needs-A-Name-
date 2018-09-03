class Tool_Handler{
    constructor(){ 
        this.tools = {
            drawtool: new Draw_Tool("drawtool"),
            eraser: new Eraser_Tool("eraser"),
            line: new Line_Tool("line"),
            select: new Selection_Tool("select"),
            fill: new Fill_Tool("fill"),
            eyedropper: new Eyedropper_Tool("eyedropper"),
            rectangle: new Rectangle_Tool("rectangle"),
            hand: new Hand_Tool("hand")
        }
        
        this.current_tool = this.tools.drawtool;
        this.change_tool("drawtool")
    }   

    change_tool(tool_id){
        if(tool_id != this.current_tool.id){
            this.prev_tool = this.current_tool;
            this.prev_tool.on_exit();
            this.set_inactive_styles(this.prev_tool)
        }
        this.current_tool = this.tools[tool_id];
        this.current_tool.on_enter();
        this.set_active_styles(this.current_tool);
    }

    set_active_styles(tool){
        tool.elem.style.boxShadow = "0px 0px 0px 3px yellow inset";
    }

    set_inactive_styles(tool){
        tool.elem.style.boxShadow = "none";
    }
}

class Tool{
    constructor(id){ 
        this.elem = document.getElementById(id); 
        this.elem.onmouseover = function(){
            if(state.tool_handler.current_tool.elem != this){
                this.style.backgroundColor = "rgb(116, 116, 124)";
            }
        }
        this.elem.onmouseout = function(){
            this.style.backgroundColor = "transparent";
        }
        this.elem.onclick = function(){
            state.tool_handler.change_tool(this.id);
            this.style.backgroundColor = "transparent";
        }
    }
    on_enter(){}
    mousedown_actions(){}
    mousemove_actions(){}
    mouseup_actions(){}
    on_exit(){}
}

class Draw_Tool extends Tool{
    constructor(id){ super(id); }

    mousedown_actions(){
        if(!state.current_selection.contains_mouse()){ return; }
        state.main_canvas.draw_pixel(state.color_picker.color, ...state.pixel_pos);
        var data = state.main_canvas.get_data(...state.pixel_pos);
        state.history_manager.push_prev_data(data);
        data.rgba = state.color_picker.rgba; 
        state.history_manager.push_new_data(data);  
    }

    mousemove_actions(){
        state.main_canvas.draw_buffer.push(state.pixel_pos);
        if (state.main_canvas.draw_buffer.length == 2){
            state.main_canvas.line(...state.main_canvas.draw_buffer[0], ...state.main_canvas.draw_buffer[1])
            state.main_canvas.draw_buffer.shift()
        }
    }

    mouseup_actions(){
        state.history_manager.add_history("pen-stroke")
        state.main_canvas.draw_buffer = [];
        state.preview_canvas.redraw();
    }
}

class Eraser_Tool extends Tool{
    constructor(id){ super(id); }

    on_enter(){
        state.mouse_indicator.style.backgroundColor = "white";
    }

    mousedown_actions(){
        state.main_canvas.erase_pixel(...state.pixel_pos)
        state.mouse_indicator.style.backgroundColor = "white";
    }

    mousemove_actions(){
        state.main_canvas.draw_buffer.push(state.pixel_pos);
        if (state.main_canvas.draw_buffer.length == 2){
            state.main_canvas.line(...state.main_canvas.draw_buffer[0], ...state.main_canvas.draw_buffer[1], true)
            state.main_canvas.draw_buffer.shift()
        }
        state.mouse_indicator.style.backgroundColor = "white";
    }

    mouseup_actions(){
        state.history_manager.add_history("pen-stroke");
        state.main_canvas.draw_buffer = [];
        state.preview_canvas.redraw();
    }

    on_exit(){
        state.mouse_indicator.style.backgroundColor = state.color_picker.color;
    }
}

class Line_Tool extends Tool{
    constructor(id){ super(id); }
    
    mousemove_actions(){
        state.main_canvas.clear_preview();
        state.line_end = state.pixel_pos;
        state.main_canvas.preview_line(state.mouse_start[0], state.mouse_start[1], state.pixel_pos[0], state.pixel_pos[1]);
    }

    mouseup_actions(){
        state.main_canvas.clear_preview();
        state.main_canvas.line(state.mouse_start[0], state.mouse_start[1], state.pixel_pos[0], state.pixel_pos[1]);
        state.history_manager.add_history("pen-stroke");
        state.preview_canvas.redraw();
    }
}

class Selection_Tool extends Tool{
    constructor(id){ super(id); }

    on_enter(){
        state.mouse_indicator.style.display = "none"
        document.body.style.cursor = "crosshair";
    }

    mousedown_actions(){
        state.history_manager.prev_selection = state.current_selection.get_selection_info();
        if(state.active_element == state.canvas_area && !state.current_selection.contains_mouse()){
            state.current_selection.clear();
        }
        if (!state.current_selection.contains_mouse() || !state.current_selection.exists){
            state.current_selection.forming = true;
        }
    }
    
    mousemove_actions(){
        if(state.current_selection.forming){
            state.selection_end = state.pixel_pos;
            state.current_selection.draw();
            var w = calc_distance(state.mouse_start[0], state.selection_end[0]);
            var h = calc_distance(state.mouse_start[1], state.selection_end[1]);
            update_rect_size_preview(w, h)
        } 
        if (state.current_selection.exists && state.current_selection.contains_mouse() && !state.current_selection.forming || state.current_selection.being_dragged){
            state.current_selection.being_dragged = true;
            state.current_selection.drag();
        }
    }

    mouseup_actions(){
        state.selection_size_element.style.display = "none";
        state.current_selection.forming = false;
        state.current_selection.being_dragged = false;
        state.current_selection.get_intersection();
        state.history_manager.new_selection = state.current_selection.get_selection_info();
        state.history_manager.add_history("selection")
    }

    on_exit(){
        document.body.style.cursor = "default";
        state.mouse_indicator.style.display = "block";
        state.mouse_indicator.style.backgroundColor = state.color_picker.color;
    }
}

class Fill_Tool extends Tool{
    constructor(id){ super(id); }

    mousedown_actions(){
        state.main_canvas.fill(...state.pixel_pos, state.color_picker.rgba, state.main_canvas.get_data(...state.pixel_pos).rgba);
        state.history_manager.add_history("pen-stroke");
        state.preview_canvas.redraw();
    }
}

class Eyedropper_Tool extends Tool{
    constructor(id){ super(id); }

    mousedown_actions(){
        for(var i = state.layer_manager.layers.length - 1; i >= 0; i--){
            state.eyedropper_ctx.drawImage(state.layer_manager.layers[i].render_canvas, 0, 0)
        }
        state.color_picker.update_color("eyedropper");
    }
    
    mousemove_actions(){
        state.color_picker.update_color("eyedropper");
    }

    mouseup_actions(){
        state.eyedropper_ctx.clearRect(0, 0, state.main_canvas.w, state.main_canvas.h);
    }
}

class Rectangle_Tool extends Tool{
    constructor(id){ super(id); }

    mousedown_actions(){
        state.rectangle_end = state.mouse_start;
        var w = calc_distance(state.mouse_start[0], state.rectangle_end[0]);
        var h = calc_distance(state.mouse_start[1], state.rectangle_end[1]);
        update_rect_size_preview(w, h);
    }
    
    mousemove_actions(){
        state.main_canvas.clear_preview();
        state.rectangle_end = state.pixel_pos;
        state.main_canvas.preview_rectangle(...state.mouse_start, ...state.rectangle_end);
        var w = calc_distance(state.mouse_start[0], state.rectangle_end[0]);
        var h = calc_distance(state.mouse_start[1], state.rectangle_end[1]);
        update_rect_size_preview(w, h);
    }
    
    mouseup_actions(){
        state.main_canvas.clear_preview();
        state.main_canvas.rectangle(...state.mouse_start, ...state.rectangle_end);
        state.selection_size_element.style.display = "none";
        state.history_manager.add_history("pen-stroke");
        state.preview_canvas.redraw();
    }
}

class Hand_Tool extends Tool{
    constructor(id){ super(id); }

    on_enter(){
        document.body.style.cursor = "grab";
        state.mouse_indicator.style.display = "none";
    }
    
    mousemove_actions(){
        drag_element(state.canvas_wrapper, state.delta_mouse);
        state.current_selection.move(state.delta_mouse[0], state.delta_mouse[1]);
    }

    on_exit(){
        document.body.style.cursor = "default";
        state.mouse_indicator.style.display = "block";
    }
}