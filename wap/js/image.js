let pendingPartImageFile = null;


function ensurePartImageUi() {

    if (
        document.getElementById(
            "part-image-editor"
        )
    ) {
        return;
    }


    const readonlyInfo =
        document.querySelector(
            "#page-part-edit .readonly-info"
        );


    if (!readonlyInfo) {
        return;
    }


    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.id =
        "part-image-editor";

    wrapper.innerHTML = `
        <style>
            #part-image-editor {
                margin: 0 0 20px;
            }

            #part-image-editor > label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                font-weight: 700;
            }

            .part-image-preview {
                display: flex;
                align-items: center;
                justify-content: center;
                width: min(100%, 420px);
                aspect-ratio: 1 / 1;
                overflow: hidden;
                border: 1px dashed #cbd5e1;
                border-radius: 12px;
                background: #f8fafc;
                color: #64748b;
                text-align: center;
            }

            .part-image-preview img {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: cover;
                background: white;
            }

            .part-image-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-top: 10px;
            }

            .part-image-actions button,
            .part-image-file-label {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 44px;
                padding: 10px 12px;
                border: 0;
                border-radius: 9px;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
            }

            .part-image-file-label {
                background: #e5e7eb;
                color: #111827;
            }

            #part-image-input {
                display: none;
            }

            #part-image-remove-button {
                grid-column: 1 / -1;
                background: #dc2626;
                color: white;
            }

            #part-image-message {
                min-height: 18px;
                margin: 8px 0 0;
                font-size: 13px;
                font-weight: 700;
            }

            @media (max-width: 700px) {
                .part-image-preview {
                    width: 100%;
                }

                .part-image-actions {
                    grid-template-columns: 1fr;
                }

                #part-image-remove-button {
                    grid-column: auto;
                }
            }
        </style>

        <label>상품 사진</label>

        <div
            id="part-image-preview"
            class="part-image-preview"
        >
            등록된 사진 없음
        </div>

        <div class="part-image-actions">
            <label
                for="part-image-input"
                class="part-image-file-label"
            >
                + 사진 선택
            </label>

            <input
                id="part-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
            >

            <button
                id="part-image-upload-button"
                type="button"
            >
                사진 저장
            </button>

            <button
                id="part-image-remove-button"
                type="button"
            >
                사진 삭제
            </button>
        </div>

        <p id="part-image-message"></p>
    `;


    readonlyInfo.before(
        wrapper
    );


    document
        .getElementById(
            "part-image-input"
        )
        .addEventListener(
            "change",
            previewSelectedPartImage
        );


    document
        .getElementById(
            "part-image-upload-button"
        )
        .addEventListener(
            "click",
            uploadSelectedPartImage
        );


    document
        .getElementById(
            "part-image-remove-button"
        )
        .addEventListener(
            "click",
            removePartImage
        );

}


function getEditingPart() {

    if (
        typeof editingPartId === "undefined"
        || editingPartId === null
    ) {
        return null;
    }


    return cachedParts.find(
        part =>
            Number(part.id)
            === Number(editingPartId)
    ) || null;

}


function showPartImage(imageUrl) {

    const preview =
        document.getElementById(
            "part-image-preview"
        );


    if (!preview) {
        return;
    }


    if (!imageUrl) {
        preview.innerHTML =
            "등록된 사진 없음";
        return;
    }


    const image =
        document.createElement(
            "img"
        );

    image.src = imageUrl;
    image.alt = "상품 사진";

    preview.innerHTML = "";
    preview.appendChild(image);

}


function loadImageFromFile(file) {

    return new Promise(
        (resolve, reject) => {

            const image = new Image();
            const url = URL.createObjectURL(file);

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(
                    new Error(
                        "이미지를 불러오지 못했습니다."
                    )
                );
            };

            image.src = url;

        }
    );

}


function canvasToBlob(canvas, type) {

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                blob => {

                    if (!blob) {
                        reject(
                            new Error(
                                "이미지 변환에 실패했습니다."
                            )
                        );
                        return;
                    }

                    resolve(blob);

                },
                type,
                0.92
            );

        }
    );

}


async function cropImageFileToSquare(file) {

    const image =
        await loadImageFromFile(file);

    const sourceSize = Math.min(
        image.naturalWidth,
        image.naturalHeight
    );

    const sourceX = Math.floor(
        (image.naturalWidth - sourceSize) / 2
    );

    const sourceY = Math.floor(
        (image.naturalHeight - sourceSize) / 2
    );

    const outputSize = Math.min(
        1200,
        sourceSize
    );

    const canvas =
        document.createElement("canvas");

    canvas.width = outputSize;
    canvas.height = outputSize;

    const context =
        canvas.getContext("2d");

    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
    );

    const outputType = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ].includes(file.type)
        ? file.type
        : "image/jpeg";

    const blob =
        await canvasToBlob(
            canvas,
            outputType
        );

    const extension =
        outputType === "image/png"
            ? "png"
            : outputType === "image/webp"
                ? "webp"
                : "jpg";

    return new File(
        [blob],
        `product-square.${extension}`,
        {
            type: outputType
        }
    );

}


function loadEditingPartImage() {

    ensurePartImageUi();

    pendingPartImageFile = null;


    const input =
        document.getElementById(
            "part-image-input"
        );

    if (input) {
        input.value = "";
    }


    const message =
        document.getElementById(
            "part-image-message"
        );

    if (message) {
        message.textContent = "";
    }


    const part =
        getEditingPart();

    showPartImage(
        part?.["이미지"] || ""
    );

}


async function previewSelectedPartImage(event) {

    const file =
        event.target.files?.[0];


    if (!file) {
        pendingPartImageFile = null;
        return;
    }


    if (
        ![
            "image/jpeg",
            "image/png",
            "image/webp"
        ].includes(file.type)
    ) {
        alert(
            "JPG, PNG, WEBP 이미지만 선택해주세요."
        );
        event.target.value = "";
        pendingPartImageFile = null;
        return;
    }


    if (
        file.size
        > 10 * 1024 * 1024
    ) {
        alert(
            "이미지는 10MB 이하만 등록할 수 있습니다."
        );
        event.target.value = "";
        pendingPartImageFile = null;
        return;
    }


    const message =
        document.getElementById(
            "part-image-message"
        );

    message.textContent =
        "사진을 정사각형으로 자르는 중...";


    try {

        pendingPartImageFile =
            await cropImageFileToSquare(
                file
            );

        const previewUrl =
            URL.createObjectURL(
                pendingPartImageFile
            );

        showPartImage(
            previewUrl
        );

        message.textContent =
            "가운데 기준으로 1:1 정사각형으로 잘랐습니다. 사진 저장을 눌러주세요.";

    }
    catch (error) {

        console.error(error);

        pendingPartImageFile = null;
        event.target.value = "";

        message.textContent =
            "사진을 처리하지 못했습니다.";

    }

}


async function uploadSelectedPartImage() {

    const message =
        document.getElementById(
            "part-image-message"
        );


    if (
        typeof editingPartId === "undefined"
        || editingPartId === null
    ) {
        message.textContent =
            "수정 중인 부품이 없습니다.";
        return;
    }


    if (!pendingPartImageFile) {
        message.textContent =
            "먼저 사진을 선택해주세요.";
        return;
    }


    message.textContent =
        "사진 저장 중...";


    try {

        const response =
            await fetch(
                `/api/parts/${editingPartId}/image`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            pendingPartImageFile.type
                    },
                    body:
                        pendingPartImageFile
                }
            );


        const result =
            await response.json();


        if (!response.ok) {
            message.textContent =
                result.detail
                || "사진 저장 실패";
            return;
        }


        pendingPartImageFile = null;

        await loadParts();

        const part =
            getEditingPart();

        showPartImage(
            part?.["이미지"]
            || result.image
        );

        message.textContent =
            "정사각형 사진 저장 완료";

    }
    catch (error) {

        console.error(error);

        message.textContent =
            "서버 연결 실패";

    }

}


async function removePartImage() {

    const message =
        document.getElementById(
            "part-image-message"
        );


    if (
        typeof editingPartId === "undefined"
        || editingPartId === null
    ) {
        return;
    }


    const part =
        getEditingPart();


    if (!part?.["이미지"]) {
        message.textContent =
            "삭제할 사진이 없습니다.";
        return;
    }


    if (
        !confirm(
            "등록된 상품 사진을 삭제할까요?"
        )
    ) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/parts/${editingPartId}/image`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {
            message.textContent =
                result.detail
                || "사진 삭제 실패";
            return;
        }


        pendingPartImageFile = null;

        await loadParts();

        showPartImage("");

        message.textContent =
            "사진을 삭제했습니다.";

    }
    catch (error) {

        console.error(error);

        message.textContent =
            "서버 연결 실패";

    }

}


ensurePartImageUi();


const imageOriginalOpenPartEdit =
    window.openPartEdit;


if (
    typeof imageOriginalOpenPartEdit
    === "function"
) {

    window.openPartEdit = function (
        partId
    ) {

        imageOriginalOpenPartEdit(
            partId
        );

        loadEditingPartImage();

    };

}
