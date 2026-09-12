const menuButtons =
    document.querySelectorAll(
        ".menu-button"
    );


const pages =
    document.querySelectorAll(
        ".page"
    );


function openPage(
    pageName,
    menuName = pageName
) {

    pages.forEach(
        page => {
            page.classList.remove(
                "active"
            );
        }
    );


    menuButtons.forEach(
        button => {
            button.classList.remove(
                "active"
            );
        }
    );


    const targetPage =
        document.getElementById(
            "page-" + pageName
        );


    if (targetPage) {

        targetPage.classList.add(
            "active"
        );

    }


    const targetButton =
        document.querySelector(
            `.menu-button[data-page="${menuName}"]`
        );


    if (targetButton) {

        targetButton.classList.add(
            "active"
        );

    }

}


menuButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                openPage(
                    button.dataset.page
                );

            }
        );

    }
);


/* 상품 사진 편집 기능 */

const imageEditorScript =
    document.createElement(
        "script"
    );

imageEditorScript.src =
    "/js/image.js";

imageEditorScript.defer = true;

document.body.appendChild(
    imageEditorScript
);
