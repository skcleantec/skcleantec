package com.skcleantec.telecrm.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.skcleantec.telecrm.R

data class SimpleRow(val title: String, val subtitle: String)

class SimpleRowAdapter(
    private val onClick: (Int) -> Unit,
) : RecyclerView.Adapter<SimpleRowAdapter.VH>() {
    private val items = mutableListOf<SimpleRow>()

    fun submit(list: List<SimpleRow>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_simple_row, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val row = items[position]
        holder.title.text = row.title
        holder.subtitle.text = row.subtitle
        holder.itemView.setOnClickListener { onClick(position) }
    }

    override fun getItemCount() = items.size

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.rowTitle)
        val subtitle: TextView = view.findViewById(R.id.rowSubtitle)
    }
}
