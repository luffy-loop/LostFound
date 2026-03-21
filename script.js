
(function () {
    const user = localStorage.getItem("userRoll");
    if (!user && !location.pathname.includes("login.html")) {
        location = "login.html";
    }
})();

function login() {
    let roll = document.getElementById("roll").value.trim();

    if (!/^\d{10}$/.test(roll)) {
        alert("Enter valid 10-digit roll number");
        return;
    }

    localStorage.setItem("userRoll", roll);
    location = "index.html";
}

function logout() {
    localStorage.clear();
    location = "login.html";
}

function goToPost() { location = "post.html"; }
function goHome() { location = "index.html"; }
function goToMyPosts() { location = "myposts.html"; }

function previewImage() {
    let file = document.getElementById("image")?.files[0];
    let preview = document.getElementById("preview");

    if (file && preview) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";
    }
}

function openImage(src) {
    let modal = document.getElementById("modal");
    let modalImg = document.getElementById("modalImg");

    if (modal && modalImg) {
        modal.style.display = "flex";
        modalImg.src = src;
    }
}

function addItem() {

    let name = document.getElementById("itemName").value.trim();
    let desc = document.getElementById("description").value.trim();
    let loc = document.getElementById("location").value.trim();
    let category = document.getElementById("category").value.trim();
    let file = document.getElementById("image").files[0];

    if (!name || !desc || !loc) {
        alert("Please fill all fields");
        return;
    }

    let reader = new FileReader();

    reader.onload = function () {

        let item = {
            id: Date.now(),
            itemName: name,
            description: desc,
            location: loc,
            category: category,
            image: file ? reader.result : null,
            roll: localStorage.getItem("userRoll"),
            status: "Searching"
        };

        let items = JSON.parse(localStorage.getItem("items")) || [];
        items.push(item);

        localStorage.setItem("items", JSON.stringify(items));

        alert("Item posted successfully!");
        location = "index.html";
    };

    if (file) reader.readAsDataURL(file);
    else reader.onload();
}

function displayItems() {

    let container = document.getElementById("itemsContainer");
    if (!container) return;

    let search = document.getElementById("search")?.value?.toLowerCase() || "";
    let items = JSON.parse(localStorage.getItem("items")) || [];

    if (location.pathname.includes("myposts.html")) {
        let user = localStorage.getItem("userRoll");
        items = items.filter(i => i.roll === user);
    }

    container.innerHTML = "";

    if (items.length === 0) {
        container.innerHTML = "<h2 style='text-align:center'>No items found</h2>";
        return;
    }

    items
        .filter(i =>
            i.itemName.toLowerCase().includes(search) ||
            i.location.toLowerCase().includes(search)
        )
        .forEach(i => {

          container.innerHTML += `
<div class="item">

    ${i.image ? `
    <div class="img-box">
        <img src="${i.image}" onclick="openImage('${i.image}')">
    </div>
    ` : ""}

    <div class="card-body">

        <h3>${i.itemName}</h3>

        <p class="location">📍 ${i.location}</p>

        <p class="desc">${i.description}</p>

        <div class="meta-row">
            <span>Category: ${i.category || "N/A"}</span>
            <span>Status: ${i.status}</span>
        </div>

        <p class="posted">Posted by: ${i.roll}</p>

        <select onchange="updateStatus(${i.id}, this.value)">
            <option value="">Update Status</option>
            <option value="Searching">Searching</option>
            <option value="Office">Submitted</option>
            <option value="Returned">Returned</option>
        </select>

        <input placeholder="Add comment..."
        onkeypress="if(event.key==='Enter') addComment(${i.id}, this.value)">

    </div>

</div>
`;
        });
}

displayItems();
