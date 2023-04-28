//  This is where most of your code changes belong

function subdivider (input_mesh) {
    this.meshes = [];
    
    // Initializes this subdivision object with a mesh to use as 
    // the control mesh (ie: subdivision level 0).
    this.meshes.push(input_mesh);


    this.setMesh = function (input_mesh) {
        this.meshes.push(input_mesh);
    }

    this.subdivide = function (level) {
        // Subdivides the control mesh to the given subdivision level  .
        // Returns the subdivided mesh .

        // HINT: Create a new subdivision mesh for each subdivision level and 
        // store it in memory for later .
        // If the calling code asks for a level that has already been computed,
        // just return the pre-computed mesh!

        //return NULL; // REPLACE THIS!
        
        //@@@@@
        let mesh = new Mesh();
        mesh.copyMesh(this.meshes[0]);
        for (let l = 0; l < level; l++) {
            // Calculate new
            let newPos = []
            for (let edge of mesh.getEdges()) {
                if (edge.getTwin().getFlag() !== "visited") {
                    newPos.push(this.calculate_new(edge));
                    edge.setFlag("visited");
                }
            }

            // Calculate old
            let oldPos = []
            for (let vertex of mesh.getVertices()) {
                oldPos.push(this.calculate_old(vertex));
            }

            // Init
            for (let vertex of mesh.getVertices()) {
                vertex.setFlag("isOld");
            }
            for (let edge of mesh.getEdges()) {
                edge.setFlag("notSplit");
            }

            let vertices = mesh.getVertices();
            let vertex_ori_len = vertices.length;

            // Edge split
            let edges = mesh.getEdges();
            let edge_ori_len = edges.length;
            for (let i=0; i<edge_ori_len; i++) {
                if (edges[i].getFlag() === "notSplit") {
                    this.edge_split(edges[i], mesh);
                }
            }

            // Corner cut
            let faces = mesh.getFaces();
            let face_ori_len = faces.length;
            for (let i = 0; i < face_ori_len; i++) {
                for (let j = 0; j < 3; j++) {
                    this.cut_corner(faces[i], mesh);
                }
            }
            mesh.computeNormal();

            // Set pos
            for (let i = 0; i < oldPos.length; i++) {
                vertices[i].setPos(oldPos[i].value[0], oldPos[i].value[1], oldPos[i].value[2]);
            }
            for (let i = 0; i < newPos.length; i++) {
                vertices[vertex_ori_len+i].setPos(newPos[i].value[0], newPos[i].value[1], newPos[i].value[2]);
            }
        }
        //@@@@@
        console.log(mesh); 
        return mesh;
    }

    this.calculate_new = function(he) {
        let p1 = he.getOrigin().getPos().value;
        let p2 = he.getTwin().getOrigin().getPos().value;
        let p3 = he.getPrev().getOrigin().getPos().value;
        let p4 = he.getTwin().getPrev().getOrigin().getPos().value;
        let new_x = 3/8*p1[0]+3/8*p2[0]+1/8*p3[0]+1/8*p4[0];
        let new_y = 3/8*p1[1]+3/8*p2[1]+1/8*p3[1]+1/8*p4[1];
        let new_z = 3/8*p1[2]+3/8*p2[2]+1/8*p3[2]+1/8*p4[2];
        return new Vec3(new_x, new_y, new_z);
    }

    this.calculate_old = function(v) {
        let posList = []
        let curr_pos = v.getPos().value;
        let he = v.getEdge();
        while (true) {
            posList.push(he.getPrev().getOrigin().getPos().value);
            he = he.getPrev().getTwin();
            if (he === v.getEdge()) {
                break;
            }
        }
        let n = posList.length;
        let alpha = 1/64*(40-(3+2*Math.cos(2*Math.PI/n))**2); // alpha/n
        let new_x = (1-alpha)*curr_pos[0];
        let new_y = (1-alpha)*curr_pos[1];
        let new_z = (1-alpha)*curr_pos[2];
        for (let pos of posList) {
            new_x += alpha/n * pos[0];
            new_y += alpha/n * pos[1];
            new_z += alpha/n * pos[2];
        }
        return new Vec3(new_x, new_y, new_z);
    }

    this.edge_split = function(he, M) {
        // Add new vertex v to M and mark v as new
        let v1 = he.getOrigin();
        let v2 = he.getNext().getOrigin()
        let pos1 = v1.getPos().value;
        let pos2 = v2.getPos().value;
        let index = M.getVertices().length;
        let new_vertex = M.addVertexPos((pos1[0]+pos2[0])/2, (pos1[1]+pos2[1])/2, (pos1[2]+pos2[2])/2, index);
        new_vertex.setFlag("isNew");

        let he_prev_prev = he.getPrev();
        let he_twin_next = he.getTwin().getNext();
        let he_twin = he.getTwin();

        let pointToList = [];
        let pointOutList = [];
        let curr_edge = he;
        while (true) {
            if (curr_edge.getPrev().getTwin() === he) {
                break;
            } else {
                pointToList.push(curr_edge.getPrev());
                curr_edge = curr_edge.getPrev().getTwin();
                pointOutList.push(curr_edge);
            }
        }

        // Add 2 new halfedges to M
        let he_prev = M.addEdge(v1, new_vertex);
        let he_prev_twin = M.addEdge(new_vertex, v1);

        // Set affected origins
        if (v1.getEdge() === he) {
            v1.setEdge(he_prev);
        }
        he.setOrigin(new_vertex);

        // Set affected next and prev
        he_prev.setNext(he);
        he.setPrev(he_prev);
        he_twin.setNext(he_prev_twin);
        he_prev_twin.setPrev(he_twin);

        he_prev_twin.setNext(he_twin_next);
        he_prev.setPrev(he_prev_prev);

        for (let edge of pointToList) {
            if (edge.getNext() === he) {
                edge.setNext(he_prev);
            }
        }

        for (let edge of pointOutList) {
            if (edge.getPrev() === he_twin) {
                edge.setPrev(he_prev_twin);
            }
        }

        // Update he and he.twin key
        var he_ori_key = String(v1.getId()) + "," + String(v2.getId());
        var he_twin_ori_key = String(v2.getId()) + "," + String(v1.getId());
        var he_new_key = String(new_vertex.getId()) + "," + String(v2.getId());
        var he_twin_new_key = String(v2.getId()) + "," + String(new_vertex.getId());
        M.edgeMap.set(he_new_key, he);
        M.edgeMap.set(he_twin_new_key, he_twin);
        M.edgeMap.delete(he_ori_key);
        M.edgeMap.delete(he_twin_ori_key);
        
        // Mark as split
        he.setFlag("isSplit");
        he_twin.setFlag("isSplit");
        he_prev.setFlag("isSplit");
        he_prev_twin.setFlag("isSplit");
    }

    this.cut_corner = function(f, M) {
        let he = f.getEdge();
        while (he.getOrigin().getFlag() !== "isNew" ||
        he.getNext().getOrigin().getFlag() !== "isOld" ||
        he.getNext().getNext().getOrigin().getFlag() !== "isNew") {
            he = he.getNext();
        }

        // Add new halfedge h to M.
        let v1 = he.getOrigin();
        let v2 = he.getNext().getNext().getOrigin();
        let new_edge = M.addEdge(v2, v1);
        let new_edge_twin = M.addEdge(v1, v2);
    
        // Update f.he() and add a new face to M
        let he_next = he.getNext();
        let he_next_next = he_next.getNext();
        let he_prev = he.getPrev();
        M.addFaceByHE(he, he_next, new_edge);

        // Update affected
        f.setEdge(new_edge_twin);
        new_edge_twin.setFace(f);
        new_edge_twin.setNext(he_next_next);
        he_next_next.setPrev(new_edge_twin);
        new_edge_twin.setPrev(he_prev);
        he_prev.setNext(new_edge_twin);

        // Mark h as already split
        new_edge.setFlag("isSplit");
        new_edge_twin.setFlag("isSplit");
    }

    this.clear = function (m) {
        this.meshes = [];
    }
}