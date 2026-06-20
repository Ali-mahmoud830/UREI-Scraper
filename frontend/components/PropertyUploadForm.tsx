"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, Save, Building, MapPin, DollarSign, Text } from "lucide-react";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabase";

interface FloorData {
    level: string;
    sqm: string;
    rooms: string;
    features: string;
}

interface PropertyUploadFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function PropertyUploadForm({ onClose, onSuccess }: PropertyUploadFormProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [location, setLocation] = useState("");
    const [propertyType, setPropertyType] = useState("Apartment");
    const [listingType, setListingType] = useState("sale");
    
    // Dynamic floors array
    const [floors, setFloors] = useState<FloorData[]>([
        { level: "Floor 1", sqm: "", rooms: "", features: "" }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const addFloor = () => {
        setFloors([...floors, { level: `Floor ${floors.length + 1}`, sqm: "", rooms: "", features: "" }]);
    };

    const removeFloor = (index: number) => {
        const newFloors = [...floors];
        newFloors.splice(index, 1);
        setFloors(newFloors);
    };

    const handleFloorChange = (index: number, field: keyof FloorData, value: string) => {
        const newFloors = [...floors];
        newFloors[index][field] = value;
        setFloors(newFloors);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title || !price || !location) {
            toast.error("Please fill in the required fields (Title, Price, Location).");
            return;
        }

        setIsSubmitting(true);
        try {
            // Because the properties table might not be created on the remote server yet,
            // we will insert this into `leads` for now, marking it as a manual entry.
            // When properties table is ready, you can switch this to `properties`.
            const formattedFloors = floors.map(f => ({
                level: f.level,
                area_sqm: parseInt(f.sqm) || 0,
                rooms: parseInt(f.rooms) || 0,
                features: f.features.split(',').map(feature => feature.trim()).filter(Boolean)
            }));

            const payload = {
                url: "Manual Entry",
                price: price,
                location: location,
                intent: listingType,
                // Prefix the title with a badge or property type to help UI distinguish it easily if needed,
                // but we also rely on the floor_breakdown length!
                floor_breakdown: formattedFloors
            };

            // Assuming user has run the SQL script to add floor_breakdown to leads!
            const { error } = await supabase.from('leads').insert([payload]);

            if (error) {
                console.error("Supabase Error:", error);
                toast.error(`Error saving property: ${error.message}`);
                setIsSubmitting(false);
                return;
            }

            toast.success("Property saved successfully with Multi-Floor Schema!");
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Upload Error:", err);
            toast.error(`Error: ${err.message}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0f1011] border border-emerald-500/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-emerald-500/20 bg-surface">
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Add New Property
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Upload property with dynamic multi-floor JSON schema</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form id="property-form" onSubmit={handleSubmit} className="space-y-8">
                        
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-emerald-300 border-b border-emerald-500/20 pb-2">Basic Information</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 font-medium">Property Title *</label>
                                    <div className="relative">
                                        <Text className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                        <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. 135m Luxury Penthouse" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 font-medium">Price *</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                        <input type="text" required value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. 5,000,000 EGP" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 font-medium">Location *</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                        <input type="text" required value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. 5th Settlement, New Cairo" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm text-gray-400 font-medium">Property Type</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-2.5 text-gray-500" size={18} />
                                        <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none">
                                            <option value="Apartment">Apartment</option>
                                            <option value="Penthouse">Penthouse</option>
                                            <option value="Villa">Villa</option>
                                            <option value="Commercial">Commercial</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-sm text-gray-400 font-medium">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors h-24 resize-none" placeholder="Property details..." />
                                </div>
                            </div>
                        </div>

                        {/* Floor Breakdown (Dynamic JSON Array) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                                <h3 className="text-lg font-semibold text-purple-300">Multi-Floor Breakdown</h3>
                                <button type="button" onClick={addFloor} className="flex items-center gap-1 text-xs font-semibold bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg hover:bg-purple-500/30 transition-colors">
                                    <Plus size={14} /> Add Floor
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {floors.map((floor, index) => (
                                    <div key={index} className="bg-[#161b22]/50 border border-purple-500/30 rounded-xl p-4 relative group">
                                        {floors.length > 1 && (
                                            <button type="button" onClick={() => removeFloor(index)} className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Level Name</label>
                                                <input type="text" value={floor.level} onChange={e => handleFloorChange(index, "level", e.target.value)} className="w-full bg-[#0a0f1c] border border-gray-700 rounded py-1.5 px-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="e.g. Floor 1, Roof" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Area (sqm)</label>
                                                <input type="text" value={floor.sqm} onChange={e => handleFloorChange(index, "sqm", e.target.value)} className="w-full bg-[#0a0f1c] border border-gray-700 rounded py-1.5 px-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="e.g. 70" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Rooms (Number)</label>
                                                <input type="number" value={floor.rooms} onChange={e => handleFloorChange(index, "rooms", e.target.value)} className="w-full bg-[#0a0f1c] border border-gray-700 rounded py-1.5 px-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="e.g. 3" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Features (Comma separated)</label>
                                                <input type="text" value={floor.features} onChange={e => handleFloorChange(index, "features", e.target.value)} className="w-full bg-[#0a0f1c] border border-gray-700 rounded py-1.5 px-3 text-sm text-white focus:border-purple-500 outline-none" placeholder="e.g. Jacuzzi, BBQ" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-emerald-500/20 bg-surface flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="property-form" disabled={isSubmitting} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                        {isSubmitting ? (
                             <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save size={18} />
                        )}
                        Save to Database
                    </button>
                </div>
            </div>
        </div>
    );
}
