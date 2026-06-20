import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.config.js";

const productRef = collection(db, "products");

export const addProduct = async(data)=>{
  return addDoc(productRef, data);
};

export const getProducts = async()=>{
  return getDocs(productRef);
};

export const deleteProduct = async(id)=>{
  return deleteDoc(doc(db, "products", id));
};

export const updateProduct = async(id, data)=>{
  return updateDoc(doc(db, "products", id), data);
};