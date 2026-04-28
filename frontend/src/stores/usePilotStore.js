import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../services/api";

export const usePilotStore = defineStore("pilot", () => {
  const concepts = ref([]);
  const templates = ref([]);
  const dataElements = ref([]);
  const selectedConcept = ref(null);   // null = All Concepts
  const selectedTemplate = ref(null);  // null = no template selected
  const selectedElement = ref(null);

  async function fetchConcepts() {
    concepts.value = await api.get("/pilot/concepts");
  }

  // Dipanggil saat concept dropdown berubah
  async function changeConcept(conceptId) {
    selectedConcept.value = conceptId || null;
    selectedTemplate.value = null;
    selectedElement.value = null;

    const conceptQuery = conceptId ? `?concept=${conceptId}` : "";
    const [t, e] = await Promise.all([
      api.get(`/pilot/templates${conceptQuery}`),
      api.get(`/pilot/data-elements${conceptQuery}`),
    ]);
    templates.value = t;
    dataElements.value = e;
  }

  // Dipanggil saat template diklik
  async function selectTemplate(templateId) {
    selectedTemplate.value = templateId;
    selectedElement.value = null;
    dataElements.value = [];

    const conceptQuery = selectedConcept.value ? `?concept=${selectedConcept.value}` : "";
    dataElements.value = await api.get(
      `/pilot/templates/${templateId}/elements${conceptQuery}`
    );
  }

  async function fetchDataElement(id) {
    selectedElement.value = await api.get(`/pilot/data-elements/${id}`);
    return selectedElement.value;
  }

  async function updateDataElement(id, fields) {
    return api.put(`/pilot/data-elements/${id}`, { fields });
  }

  return {
    concepts,
    templates,
    dataElements,
    selectedConcept,
    selectedTemplate,
    selectedElement,
    fetchConcepts,
    changeConcept,
    selectTemplate,
    fetchDataElement,
    updateDataElement,
  };
});
