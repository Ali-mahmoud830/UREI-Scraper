"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
                toast.error(`${t('upload.toast.error')}: ${error.message}`);
                setIsSubmitting(false);
                return;
            }

            toast.success(t('upload.toast.success'));
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Upload Error:", err);
            toast.error(`Error: ${err.message}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-surface border border-emerald-500/30 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-emerald-500/20 flex justify-between items-center bg-emerald-500/5">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Building className="text-emerald-400" />
                        {t('upload.title')}
                    </h2>
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
                                        <DollarSign size={16} className="text-emerald-400" />
                                        {t('feed.price')} (EGP)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="e.g. 15000000"
                                        className="w-full bg-[#0A0F1C] border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
                                        <MapPin size={16} className="text-cyan-400" />
                                        {t('upload.location')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g. Obour City, Industrial Zone"
                                        className="w-full bg-[#0A0F1C] border border-cyan-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('upload.propertyType')}</label>
                                    <select
                                        value={propertyType}
                                        onChange={(e) => setPropertyType(e.target.value)}
                                        className="w-full bg-[#0A0F1C] border border-emerald-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-emerald-400"
                                    >
                                        <option value="Apartment">{t('scraper.categories.apartment')}</option>
                                        <option value="Villa">{t('scraper.categories.villa')}</option>
                                        <option value="Warehouse">{t('scraper.categories.warehouse')}</option>
                                        <option value="Hotel">{t('scraper.categories.hotel')}</option>
                                        <option value="Land">{t('scraper.categories.land')}</option>
                                        <option value="Shop">{t('scraper.categories.shop')}</option>
                                        <option value="Pharmacy">{t('scraper.categories.pharmacy')}</option>
                                        <option value="Showroom">{t('scraper.categories.showroom')}</option>
                                        <option value="Office">{t('scraper.categories.office')}</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('scraper.intent')}</label>
                                    <select
                                        value={listingType}
                                        onChange={(e) => setListingType(e.target.value)}
                                        className="w-full bg-[#0A0F1C] border border-purple-500/30 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-purple-400"
                                    >
                                        <option value="sale">{t('scraper.intents.sale')}</option>
                                        <option value="rent">{t('scraper.intents.rent')}</option>
                                    </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-sm text-gray-400 font-medium">Description</label>
                                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors h-24 resize-none" placeholder="Property details..." />
                                </div>
                            </div>
                        </div>

                        {/* Floor Breakdown (Dynamic JSON Array) */}
                        <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                                    <Building size={20} />
                                    {t('upload.multiFloor')}
                                </h3>
                                <button
                                    type="button"
                                    onClick={addFloor}
                                    className="flex items-center gap-1 text-sm bg-purple-500/20 text-purple-300 hover:text-white px-3 py-1.5 rounded-lg border border-purple-500/30 transition-colors"
                                >
                                    <Plus size={16} /> {t('upload.addFloor')}
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {floors.map((floor, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-black/30 p-3 rounded-lg border border-purple-500/10 relative group">
                                        {floors.length > 1 && (
                                            <button type="button" onClick={() => removeFloor(idx)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <div className="flex-1">
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{t('upload.floorName')}</label>
                                            <input 
                                                type="text" 
                                                value={floor.level}
                                                onChange={(e) => handleFloorChange(idx, 'level', e.target.value)}
                                                className="w-full bg-transparent border-b border-purple-500/30 text-white focus:outline-none focus:border-purple-400 py-1 text-sm font-semibold"
                                                placeholder="e.g. Ground Floor"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{t('upload.floorArea')} (sqm)</label>
                                            <input 
                                                type="number" 
                                                value={floor.sqm}
                                                onChange={(e) => handleFloorChange(idx, 'sqm', e.target.value)}
                                                className="w-full bg-transparent border-b border-purple-500/30 text-emerald-400 font-mono focus:outline-none focus:border-emerald-400 py-1 text-sm text-center"
                                                placeholder="400"
                                            />
                                        </div>
                                        <div className="w-20">
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{t('feed.rooms')}</label>
                                            <input 
                                                type="number" 
                                                value={floor.rooms}
                                                onChange={(e) => handleFloorChange(idx, 'rooms', e.target.value)}
                                                className="w-full bg-transparent border-b border-purple-500/30 text-white focus:outline-none focus:border-purple-400 py-1 text-sm text-center"
                                                placeholder="3"
                                            />
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{t('upload.floorFeatures')}</label>
                                            <input 
                                                type="text" 
                                                value={floor.features}
                                                onChange={(e) => handleFloorChange(idx, 'features', e.target.value)}
                                                className="w-full bg-transparent border-b border-purple-500/30 text-gray-300 focus:outline-none focus:border-purple-400 py-1 text-sm"
                                                placeholder="e.g. High ceiling, loading dock, 3-phase electricity"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-emerald-500/20 bg-surface flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-emerald-500 text-black px-8 py-2 rounded-lg font-bold hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save size={18} />
                        )}
                        {t('upload.submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}
