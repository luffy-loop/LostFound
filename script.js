// ================= AUTH CHECK =================
(function () {
    const user = localStorage.getItem("userRoll");

    if (!user && !location.pathname.includes("login.html")) {
        location = "login.html";
    }
})();

// ================= LOGIN =================
function login() {
    let r = document.getElementById("roll").value;

    if (!/^\d{10}$/.test(r)) {
        showPopup("Enter valid 10-digit roll number");
        return;
    }

    localStorage.setItem("userRoll", r);
    location = "index.html";
}

function logout() {
    localStorage.clear();
    location = "login.html";
}

// ================= NAV =================
function goToPost(){ location="post.html"; }
function goHome(){ location="index.html"; }
function goToMyPosts(){ location="myposts.html"; }

// ================= POPUP =================
function showPopup(msg){
    let popup = document.getElementById("popup");
    let text = document.getElementById("popupMsg");

    if(!popup || !text) return;

    text.innerHTML = "✅ " + msg;
    popup.style.display = "flex";
}

function closePopup(){
    let popup = document.getElementById("popup");
    if(popup) popup.style.display="none";
}

// ================= IMAGE =================
function previewImage(){
    let file = document.getElementById("image")?.files[0];
    let preview = document.getElementById("preview");

    if(file && preview){
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
    }
}

function openImage(src){
    let modal = document.getElementById("modal");
    let modalImg = document.getElementById("modalImg");

    if(modal && modalImg){
        modal.style.display="flex";
        modalImg.src = src;
    }
}

// ================= ADD ITEM =================
function addItem(){

    let name = document.getElementById("itemName").value.trim();
    let desc = document.getElementById("description").value.trim();
    let loc = document.getElementById("location").value.trim();
    let type = document.getElementById("type").value;
    let category = document.getElementById("category").value.trim();
    let urgent = document.getElementById("urgent").checked;
    let file = document.getElementById("image").files[0];

    if(!name || !desc || !loc){
        showPopup("Please fill all fields!");
        return;
    }

    let reader = new FileReader();

    reader.onload = function(){

        let item = {
            id: Date.now(),
            itemName: name,
            description: desc,
            location: loc,
            type,
            category,
            urgent,
            image: file ? reader.result : null,
            roll: localStorage.getItem("userRoll"),

            status: "Searching",
            comments: [],
            timeline: [
                {
                    status: "Posted",
                    time: new Date().toLocaleString()
                }
            ]
        };

        let items = JSON.parse(localStorage.getItem("items")) || [];
        items.push(item);
        localStorage.setItem("items", JSON.stringify(items));

        showPopup("Item posted successfully!");

        setTimeout(() => {
            location = "index.html";
        }, 1000);
    };

    if(file) reader.readAsDataURL(file);
    else reader.onload();
}

// ================= UPDATE STATUS =================
function updateStatus(id, newStatus){

    if(!newStatus) return;

    let items = JSON.parse(localStorage.getItem("items")) || [];

    items = items.map(i=>{
        if(i.id === id){
            i.status = newStatus;

            i.timeline.push({
                status: newStatus,
                time: new Date().toLocaleString()
            });
        }
        return i;
    });

    localStorage.setItem("items", JSON.stringify(items));
    displayItems();
}

// ================= COMMENTS =================
function addComment(id, text){

    if(!text.trim()) return;

    let items = JSON.parse(localStorage.getItem("items")) || [];

    items = items.map(i=>{
        if(i.id === id){
            i.comments.push(text);
        }
        return i;
    });

    localStorage.setItem("items", JSON.stringify(items));
    displayItems();
}

// ================= DISPLAY ITEMS =================
function displayItems(){

    let container = document.getElementById("itemsContainer");
    if(!container) return;

    let search = document.getElementById("search")?.value?.toLowerCase() || "";
    let items = JSON.parse(localStorage.getItem("items")) || [];

    // FILTER MY POSTS
    if(location.pathname.includes("myposts.html")){
        let user = localStorage.getItem("userRoll");
        items = items.filter(i=>i.roll === user);
    }

    container.innerHTML = "";

    if(items.length === 0){
        container.innerHTML = "<h2 style='text-align:center'>No items found</h2>";
        return;
    }

    items
    .filter(i =>
        i.itemName.toLowerCase().includes(search) ||
        i.location.toLowerCase().includes(search) ||
        i.category.toLowerCase().includes(search)
    )
    .forEach(i => {

        container.innerHTML += `
        <div class="item">

            ${i.image ? `<img src="${i.image}" onclick="openImage('${i.image}')">` : ""}

            <h3>${i.itemName}</h3>

            <p class="location">📍 ${i.location}</p>

            <p class="meta">${i.description}</p>

            <p class="meta">Category: ${i.category || "N/A"}</p>

            <p class="meta">Posted by: ${i.roll}</p>

            ${i.urgent ? `<span class="urgent">🚨 Urgent</span>` : ""}

            <p class="meta">Status: ${i.status}</p>

            <select onchange="updateStatus(${i.id}, this.value)">
                <option value="">Update Status</option>
                <option value="Searching">Searching</option>
                <option value="Office">Submitted</option>
                <option value="Returned">Returned</option>
            </select>

            <div class="timeline">
                ${i.timeline.map(t => `
                    <div>• ${t.status}</div>
                `).join("")}
            </div>

            <div>
                ${i.comments.map(c => `<p>💬 ${c}</p>`).join("")}
                <input placeholder="Add comment..."
                onkeypress="if(event.key==='Enter') addComment(${i.id}, this.value)">
            </div>

        </div>
        `;
    });
}

// ================= AUTO LOAD =================
displayItems();